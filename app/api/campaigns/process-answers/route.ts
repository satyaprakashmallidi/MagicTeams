import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  GeminiCallAnalysisService,
  CustomQuestion,
} from "@/components/smart-column-generator/services/gemini-call-analysis";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");
    const botId = searchParams.get("botId");

    if (!contactId || !botId) {
      return NextResponse.json(
        { error: "contactId and botId are required" },
        { status: 400 }
      );
    }

    // Get bot custom questions
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("custom_questions")
      .eq("id", botId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // Get contact data
    const { data: contact, error: contactError } = await supabase
      .from("call_campaign_contacts")
      .select(
        "contact_id, call_summary, ultravox_call_id, ai_processed_answers, ai_answers_generated_at, call_status"
      )
      .eq("contact_id", contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({
      contact,
      bot: { custom_questions: bot.custom_questions },
      debug: {
        contact_id: contact.contact_id,
        call_status: contact.call_status,
        has_ai_answers: !!contact.ai_processed_answers,
        ai_answers_type: typeof contact.ai_processed_answers,
        ai_answers_keys: contact.ai_processed_answers
          ? Object.keys(contact.ai_processed_answers)
          : [],
        enabled_questions:
          (bot.custom_questions as CustomQuestion[])?.filter(
            (q) => q.enabled
          ) || [],
      },
    });
  } catch (error) {
    console.error("Error in GET process-answers API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { contactIds, botId, geminiApiKey } = await request.json();

    console.log("API: Received request with:", {
      contactIds: contactIds?.length || 0,
      botId,
      hasGeminiKey: !!geminiApiKey,
    });

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "Contact IDs array is required" },
        { status: 400 }
      );
    }

    if (!botId) {
      return NextResponse.json(
        { error: "Bot ID is required" },
        { status: 400 }
      );
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key is required" },
        { status: 400 }
      );
    }

    // Get bot custom questions
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("custom_questions")
      .eq("id", botId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const customQuestions = (bot.custom_questions as CustomQuestion[]) || [];
    const enabledQuestions = customQuestions.filter((q) => q.enabled);

    if (enabledQuestions.length === 0) {
      return NextResponse.json(
        { error: "No enabled custom questions found for this bot" },
        { status: 400 }
      );
    }

    // First, let's check what contacts exist regardless of status
    const { data: allContactsCheck, error: checkError } = await supabase
      .from("call_campaign_contacts")
      .select("contact_id, call_status, call_summary")
      .in("contact_id", contactIds);

    console.log("API: All contacts check:", allContactsCheck);
    console.log("API: Check error:", checkError);

    // Get contacts with their call data (temporarily remove status filter)
    const { data: contacts, error: contactsError } = await supabase
      .from("call_campaign_contacts")
      .select(
        "contact_id, call_summary, ultravox_call_id, ai_processed_answers, ai_answers_generated_at, call_status"
      )
      .in("contact_id", contactIds);
      // .eq("call_status", "completed"); // Temporarily commented out for debugging

    if (contactsError || !contacts) {
      console.log("API: Database error:", contactsError);
      return NextResponse.json(
        { error: "Failed to fetch contacts" },
        { status: 500 }
      );
    }

    console.log("API: Found contacts:", contacts.length);
    console.log("API: Contact IDs requested:", contactIds);
    console.log(
      "API: Enabled questions:",
      enabledQuestions.map((q) => ({ id: q.id, question: q.question }))
    );
    console.log("API: Raw contacts data:", contacts);

    // Filter contacts that need processing for the enabled questions
    const contactsToProcess = contacts.filter((contact) => {
      console.log(
        "API: Checking contact:",
        contact.contact_id,
        "AI Answers:",
        contact.ai_processed_answers,
        "Type:",
        typeof contact.ai_processed_answers
      );

      // If no AI answers at all, needs processing
      if (!contact.ai_processed_answers) {
        console.log("API: No ai_processed_answers - needs processing");
        return true;
      }

      const aiAnswers = contact.ai_processed_answers as any;
      const hasAnswers = Object.keys(aiAnswers).length > 0;

      if (!hasAnswers) {
        console.log("API: Empty ai_processed_answers - needs processing");
        return true;
      }

      // Check if any enabled question is missing an answer
      const missingAnswers = enabledQuestions.some((question) => {
        const hasAnswer =
          aiAnswers[question.id] && aiAnswers[question.id].answer;
        console.log(
          `API: Question ${question.id}: hasAnswer = ${hasAnswer}, answer data:`,
          aiAnswers[question.id]
        );
        return !hasAnswer;
      });

      console.log("API: Missing answers:", missingAnswers);
      return missingAnswers;
    });

    console.log("API: Contacts to process:", contactsToProcess.length);
    console.log(
      "API: Contacts to process details:",
      contactsToProcess.map((c) => ({
        contact_id: c.contact_id,
        has_ai_answers: !!c.ai_processed_answers,
        ai_answers_keys: c.ai_processed_answers
          ? Object.keys(c.ai_processed_answers)
          : [],
      }))
    );

    if (contactsToProcess.length === 0) {
      console.log("API: No contacts to process");
      
      // Check if no contacts were found at all vs all already processed
      if (contacts.length === 0) {
        return NextResponse.json({
          message: "No completed contacts found with the provided IDs. Check the contact IDs and call status.",
          processedCount: 0,
          totalCount: 0,
          debug: {
            requestedContactIds: contactIds,
            completedContactsFound: contacts.length,
            allContactsFound: allContactsCheck?.length || 0,
            allContactsDetails: allContactsCheck || [],
            enabledQuestions: enabledQuestions.map((q) => ({
              id: q.id,
              question: q.question,
            })),
          },
        });
      }
      
      return NextResponse.json({
        message: "All selected contacts already have processed answers",
        processedCount: 0,
        totalCount: contacts.length,
        debug: {
          totalContacts: contacts.length,
          enabledQuestions: enabledQuestions.map((q) => ({
            id: q.id,
            question: q.question,
          })),
          contactDetails: contacts.map((c) => ({
            contact_id: c.contact_id,
            has_ai_answers: !!c.ai_processed_answers,
            ai_answers_keys: c.ai_processed_answers
              ? Object.keys(c.ai_processed_answers)
              : [],
          })),
        },
      });
    }

    // Initialize Gemini service
    const geminiService = new GeminiCallAnalysisService(geminiApiKey);

    let processedCount = 0;
    const errors: string[] = [];

    // Process each contact
    for (const contact of contactsToProcess) {
      try {
        // For now, we'll use the call summary. In a full implementation,
        // you might also fetch the full transcript from Ultravox
        let transcript = "";
        if (contact.ultravox_call_id) {
          // TODO: Fetch full transcript from Ultravox API if needed
          // transcript = await fetchTranscriptFromUltravox(contact.ultravox_call_id);
        }

        const processedAnswers = await geminiService.processCallWithQuestions(
          transcript,
          contact.call_summary || "",
          enabledQuestions
        );

        // Merge new answers with existing ones
        const existingAnswers = (contact.ai_processed_answers as any) || {};
        const mergedAnswers = { ...existingAnswers, ...processedAnswers };

        // Update the contact with processed answers
        const { error: updateError } = await supabase
          .from("call_campaign_contacts")
          .update({
            ai_processed_answers: mergedAnswers,
            ai_answers_generated_at: new Date().toISOString(),
          })
          .eq("contact_id", contact.contact_id);

        if (updateError) {
          errors.push(
            `Failed to save answers for contact ${contact.contact_id}: ${updateError.message}`
          );
        } else {
          processedCount++;
        }

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing contact ${contact.contact_id}:`, error);
        errors.push(
          `Failed to process contact ${contact.contact_id}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      message: `Successfully processed ${processedCount} out of ${contactsToProcess.length} contacts`,
      processedCount,
      totalCount: contacts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in process-answers API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
