export interface CustomQuestion {
  id: string;
  question: string;
  enabled: boolean;
}

export interface AIAnswer {
  question: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ProcessedAnswers {
  [questionId: string]: AIAnswer;
}

export class GeminiCallAnalysisService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Process call transcript/summary with custom questions using Gemini
   */
  async processCallWithQuestions(
    transcript: string, 
    summary: string, 
    customQuestions: CustomQuestion[]
  ): Promise<ProcessedAnswers> {
    if (!customQuestions || customQuestions.length === 0) {
      return {};
    }

    const enabledQuestions = customQuestions.filter(q => q.enabled);
    if (enabledQuestions.length === 0) {
      return {};
    }

    const prompt = this.buildAnalysisPrompt(transcript, summary, enabledQuestions);
    
    try {
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      
      const response = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
            stopSequences: [],
            candidateCount: 1
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API responded with status: ${response.status}`);
      }

      const geminiResponse = await response.json();
      const content = geminiResponse.candidates?.[0]?.content;
      const text = content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('No text found in Gemini response');
      }
      
      return this.parseGeminiResponse(text, enabledQuestions);
    } catch (error) {
      console.error('Error processing call with Gemini:', error);
      throw new Error(`Failed to process call with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build the analysis prompt for Gemini
   */
  private buildAnalysisPrompt(
    transcript: string, 
    summary: string, 
    questions: CustomQuestion[]
  ): string {
    const questionsText = questions
      .map((q, index) => `${index + 1}. ${q.question} (ID: ${q.id})`)
      .join('\n');

    return `You are an AI assistant that analyzes phone call transcripts and summaries to extract specific information.

CALL SUMMARY:
${summary || 'No summary available'}

CALL TRANSCRIPT:
${transcript || 'No transcript available'}

QUESTIONS TO ANSWER:
${questionsText}

INSTRUCTIONS:
- Analyze the call transcript and summary to answer each question
- If the information is clearly stated, provide the answer with "high" confidence
- If you can infer the answer with reasonable certainty, use "medium" confidence  
- If the information is not available or unclear, state "Not specified in the conversation" with "low" confidence
- Be specific and concise in your answers
- Extract exact numbers, dates, or specific details when available

RESPONSE FORMAT (JSON):
{
  "q1": {
    "question": "Question text here",
    "answer": "Your answer here", 
    "confidence": "high|medium|low"
  },
  "q2": {
    "question": "Question text here",
    "answer": "Your answer here",
    "confidence": "high|medium|low"
  }
}

Please respond with valid JSON only, no additional text.`;
  }

  /**
   * Parse Gemini's response and extract structured answers
   */
  private parseGeminiResponse(response: string, questions: CustomQuestion[]): ProcessedAnswers {
    try {
      // Clean up the response to extract JSON
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanResponse);
      const processedAnswers: ProcessedAnswers = {};

      // Validate and structure the response
      questions.forEach(question => {
        const answer = parsed[question.id];
        if (answer && typeof answer === 'object') {
          processedAnswers[question.id] = {
            question: question.question,
            answer: answer.answer || 'No answer provided',
            confidence: this.validateConfidence(answer.confidence)
          };
        } else {
          // Fallback if structure is unexpected
          processedAnswers[question.id] = {
            question: question.question,
            answer: 'Could not process answer',
            confidence: 'low'
          };
        }
      });

      return processedAnswers;
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      
      // Return fallback answers if parsing fails
      const fallbackAnswers: ProcessedAnswers = {};
      questions.forEach(question => {
        fallbackAnswers[question.id] = {
          question: question.question,
          answer: 'Error processing response',
          confidence: 'low'
        };
      });
      
      return fallbackAnswers;
    }
  }

  /**
   * Validate confidence level
   */
  private validateConfidence(confidence: string): 'high' | 'medium' | 'low' {
    if (['high', 'medium', 'low'].includes(confidence)) {
      return confidence as 'high' | 'medium' | 'low';
    }
    return 'low';
  }

  /**
   * Batch process multiple calls
   */
  async batchProcessCalls(
    calls: Array<{
      id: string;
      transcript: string;
      summary: string;
    }>,
    customQuestions: CustomQuestion[]
  ): Promise<Map<string, ProcessedAnswers>> {
    const results = new Map<string, ProcessedAnswers>();
    
    // Process calls sequentially to avoid rate limits
    for (const call of calls) {
      try {
        const answers = await this.processCallWithQuestions(
          call.transcript, 
          call.summary, 
          customQuestions
        );
        results.set(call.id, answers);
        
        // Add a small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing call ${call.id}:`, error);
        // Set empty answers for failed calls
        results.set(call.id, {});
      }
    }
    
    return results;
  }
}