"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useBots } from "@/hooks/use-bots"
import { agentService } from "@/lib/services/agent.service"
import { logBotOperation } from "@/lib/utils/api-logger"

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Bot name must be at least 2 characters.",
  }),
  system_prompt: z.string().min(10, {
    message: "System prompt must be at least 10 characters.",
  }),
})

type FormData = z.infer<typeof formSchema>

interface CreateBotFormProps {
  onClose: () => void
}

export function CreateBotForm({ onClose }: CreateBotFormProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { addBot } = useBots();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      model: "ultravox-v0.7",
      system_prompt: "",
    },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      logBotOperation("CREATE_FORM_SUBMIT", data);

      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error("User not authenticated")

      // Create agent via Worker API
      const agentResponse = await agentService.createAgent({
        user_id: user.id,
        name: data.name,
        voice_id: "lily", // Default voice
        system_prompt: data.system_prompt,
        model: "ultravox-v0.7", // Force ultravox-v0.7
        temperature: 7, // Default temperature
        first_speaker: "FIRST_SPEAKER_AGENT",
        selected_tools: ["hangUp"], // Default tool
      });

      logBotOperation("CREATE_SUCCESS", {
        bot_id: agentResponse.id,
        ultravox_agent_id: agentResponse.ultravox_agent_id,
        is_agent: agentResponse.is_agent,
      });

      toast({
        title: "Success",
        description: "Bot created successfully",
      })

      // Add bot to state
      addBot(agentResponse as any);
      onClose()
    } catch (error: any) {
      logBotOperation("CREATE_ERROR", {
        error: error.message,
        stack: error.stack,
      });

      toast({
        title: "Error",
        description: error.message || "Failed to create bot",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <DialogHeader>
        <DialogTitle>Create New Bot</DialogTitle>
        <DialogDescription>
          Create a new AI assistant. You can configure voice, tools, and other settings after creation.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter bot name" {...field} />
                </FormControl>
                <FormDescription>
                  This is your bot's display name.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="fixie-ai/ultravox">Standard (Default)</SelectItem>
                    <SelectItem value="fixie-ai/ultravox-70B">Advanced (70B)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  AI model for your bot's intelligence.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          /> */}
          <FormField
            control={form.control}
            name="system_prompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>System Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the system prompt for your bot"
                    className="resize-none min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  This prompt defines your bot's behavior and personality.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Bot
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}