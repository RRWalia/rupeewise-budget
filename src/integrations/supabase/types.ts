export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bot_chats: {
        Row: {
          bind_code: string | null
          bot_token: string
          bot_username: string | null
          chat_id: string | null
          created_at: string
          id: string
          last_transaction_id: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
          webhook_secret: string
        }
        Insert: {
          bind_code?: string | null
          bot_token: string
          bot_username?: string | null
          chat_id?: string | null
          created_at?: string
          id?: string
          last_transaction_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
          webhook_secret: string
        }
        Update: {
          bind_code?: string | null
          bot_token?: string
          bot_username?: string | null
          chat_id?: string | null
          created_at?: string
          id?: string
          last_transaction_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          created_at: string
          entertainment: number
          grocery: number
          health: number
          housing: number
          id: string
          loans_emis: number
          medical: number
          month: string
          monthly_income: number
          overall_budget: number
          personal: number
          savings_goal: number
          shopping: number
          travel: number
          tuition_education: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entertainment?: number
          grocery?: number
          health?: number
          housing?: number
          id?: string
          loans_emis?: number
          medical?: number
          month: string
          monthly_income?: number
          overall_budget?: number
          personal?: number
          savings_goal?: number
          shopping?: number
          travel?: number
          tuition_education?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entertainment?: number
          grocery?: number
          health?: number
          housing?: number
          id?: string
          loans_emis?: number
          medical?: number
          month?: string
          monthly_income?: number
          overall_budget?: number
          personal?: number
          savings_goal?: number
          shopping?: number
          travel?: number
          tuition_education?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pending_transactions: {
        Row: {
          amount: number
          bot_chat_id: string | null
          category: string
          category_guessed: boolean
          created_at: string
          date: string
          decided_at: string | null
          id: string
          note: string | null
          payment_mode: string
          source_fingerprint: string
          source_sender: string | null
          status: string
          telegram_message_id: number | null
          transaction_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          bot_chat_id?: string | null
          category: string
          category_guessed?: boolean
          created_at?: string
          date: string
          decided_at?: string | null
          id?: string
          note?: string | null
          payment_mode?: string
          source_fingerprint: string
          source_sender?: string | null
          status?: string
          telegram_message_id?: number | null
          transaction_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          bot_chat_id?: string | null
          category?: string
          category_guessed?: boolean
          created_at?: string
          date?: string
          decided_at?: string | null
          id?: string
          note?: string | null
          payment_mode?: string
          source_fingerprint?: string
          source_sender?: string | null
          status?: string
          telegram_message_id?: number | null
          transaction_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_transactions_bot_chat_id_fkey"
            columns: ["bot_chat_id"]
            isOneToOne: false
            referencedRelation: "bot_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_history: {
        Row: {
          edited_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          edited_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          edited_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          note: string | null
          payment_mode: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          payment_mode?: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          payment_mode?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_pending_transaction: {
        Args: {
          p_amount?: number
          p_category?: string
          p_date?: string
          p_note?: string
          p_payment_mode?: string
          p_pending_id: string
          p_type?: string
        }
        Returns: string
      }
      dismiss_pending_transaction: {
        Args: { p_pending_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
