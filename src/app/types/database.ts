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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          launch_hold: boolean
          new_member_days: number
          reminder_days: number
          reply_to: string
          sender_email: string
          sender_name: string
          site_url: string
        }
        Insert: {
          id?: number
          launch_hold?: boolean
          new_member_days?: number
          reminder_days?: number
          reply_to?: string
          sender_email?: string
          sender_name?: string
          site_url?: string
        }
        Update: {
          id?: number
          launch_hold?: boolean
          new_member_days?: number
          reminder_days?: number
          reply_to?: string
          sender_email?: string
          sender_name?: string
          site_url?: string
        }
        Relationships: []
      }
      coupon_batches: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          partner_id: string
          quantity: number
          title: string
          value_sar: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          partner_id: string
          quantity: number
          title: string
          value_sar: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          partner_id?: string
          quantity?: number
          title?: string
          value_sar?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupon_batches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "admin_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_batches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          assigned_at: string | null
          batch_id: string
          code: string
          id: string
          member_id: string | null
          redeemed_at: string | null
          status: string
        }
        Insert: {
          assigned_at?: string | null
          batch_id: string
          code?: string
          id?: string
          member_id?: string | null
          redeemed_at?: string | null
          status?: string
        }
        Update: {
          assigned_at?: string | null
          batch_id?: string
          code?: string
          id?: string
          member_id?: string | null
          redeemed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "admin_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "coupon_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience: string
          body_html: string
          created_at: string
          created_by: string | null
          failed: number
          id: string
          sent: number
          status: string
          subject: string
          total: number
        }
        Insert: {
          audience: string
          body_html: string
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          sent?: number
          status?: string
          subject: string
          total?: number
        }
        Update: {
          audience?: string
          body_html?: string
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          sent?: number
          status?: string
          subject?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          body_html: string | null
          campaign_id: string | null
          created_at: string
          error: string | null
          id: number
          kind: string
          member_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          to_email: string
          to_name: string | null
          vars: Json
        }
        Insert: {
          body_html?: string | null
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: number
          kind?: string
          member_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_email: string
          to_name?: string | null
          vars?: Json
        }
        Update: {
          body_html?: string | null
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: number
          kind?: string
          member_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_email?: string
          to_name?: string | null
          vars?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          kind: string
          label: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          kind: string
          label: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          kind?: string
          label?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      keep_alive: {
        Row: {
          id: number
        }
        Insert: {
          id: number
        }
        Update: {
          id?: number
        }
        Relationships: []
      }
      partner_devices: {
        Row: {
          expires_at: string
          partner_id: string
          pin_version: number
          token_hash: string
        }
        Insert: {
          expires_at: string
          partner_id: string
          pin_version: number
          token_hash: string
        }
        Update: {
          expires_at?: string
          partner_id?: string
          pin_version?: number
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_devices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "admin_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_devices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_at: string
          failed_tries: number
          id: string
          is_active: boolean
          locked_until: string | null
          logo_url: string | null
          name: string
          pin_hash: string
          pin_version: number
        }
        Insert: {
          created_at?: string
          failed_tries?: number
          id?: string
          is_active?: boolean
          locked_until?: string | null
          logo_url?: string | null
          name: string
          pin_hash: string
          pin_version?: number
        }
        Update: {
          created_at?: string
          failed_tries?: number
          id?: string
          is_active?: boolean
          locked_until?: string | null
          logo_url?: string | null
          name?: string
          pin_hash?: string
          pin_version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          district: string
          email: string
          expires_at: string
          full_name: string
          id: string
          is_active: boolean
          is_trial: boolean
          joined_at: string
          member_code: string
          member_no: number
          notes: string | null
          phone: string
          photo_url: string | null
          role: string
          study_year: string
          university: string
        }
        Insert: {
          created_at?: string
          district: string
          email: string
          expires_at?: string
          full_name: string
          id: string
          is_active?: boolean
          is_trial?: boolean
          joined_at?: string
          member_code?: string
          member_no?: number
          notes?: string | null
          phone: string
          photo_url?: string | null
          role?: string
          study_year: string
          university: string
        }
        Update: {
          created_at?: string
          district?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_trial?: boolean
          joined_at?: string
          member_code?: string
          member_no?: number
          notes?: string | null
          phone?: string
          photo_url?: string | null
          role?: string
          study_year?: string
          university?: string
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          coupon_id: string
          id: string
          member_id: string | null
          partner_id: string
          redeemed_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          coupon_id: string
          id?: string
          member_id?: string | null
          partner_id: string
          redeemed_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          coupon_id?: string
          id?: string
          member_id?: string | null
          partner_id?: string
          redeemed_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "admin_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_batches: {
        Row: {
          assigned: number | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          partner_id: string | null
          partner_name: string | null
          quantity: number | null
          redeemed: number | null
          remaining: number | null
          title: string | null
          value_sar: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_batches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "admin_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_batches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_members: {
        Row: {
          coupons_available: number | null
          coupons_redeemed: number | null
          created_at: string | null
          district: string | null
          email: string | null
          expires_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          is_trial: boolean | null
          joined_at: string | null
          member_code: string | null
          member_label: string | null
          member_no: number | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          role: string | null
          status: string | null
          study_year: string | null
          university: string | null
        }
        Insert: {
          coupons_available?: never
          coupons_redeemed?: never
          created_at?: string | null
          district?: string | null
          email?: string | null
          expires_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          is_trial?: boolean | null
          joined_at?: string | null
          member_code?: string | null
          member_label?: never
          member_no?: number | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          status?: never
          study_year?: string | null
          university?: string | null
        }
        Update: {
          coupons_available?: never
          coupons_redeemed?: never
          created_at?: string | null
          district?: string | null
          email?: string | null
          expires_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          is_trial?: boolean | null
          joined_at?: string | null
          member_code?: string | null
          member_label?: never
          member_no?: number | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          status?: never
          study_year?: string | null
          university?: string | null
        }
        Relationships: []
      }
      admin_partners: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          locked_until: string | null
          logo_url: string | null
          name: string | null
          pin_version: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          locked_until?: string | null
          logo_url?: string | null
          name?: string | null
          pin_version?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          locked_until?: string | null
          logo_url?: string | null
          name?: string | null
          pin_version?: number | null
        }
        Relationships: []
      }
      admin_redemptions: {
        Row: {
          coupon_code: string | null
          coupon_id: string | null
          coupon_title: string | null
          id: string | null
          member_id: string | null
          member_label: string | null
          member_name: string | null
          partner_id: string | null
          partner_name: string | null
          redeemed_at: string | null
          value_sar: number | null
          voided_at: string | null
          voided_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "admin_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_assign_coupons: {
        Args: { p_batch_id: string; p_member_ids: string[] }
        Returns: number
      }
      admin_create_batch: {
        Args: {
          p_expires_at: string
          p_partner_id: string
          p_quantity: number
          p_title: string
          p_value: number
        }
        Returns: string
      }
      admin_create_campaign: {
        Args: {
          p_audience: string
          p_body_html: string
          p_member_ids: string[]
          p_subject: string
        }
        Returns: string
      }
      admin_create_partner: {
        Args: { p_name: string; p_pin: string }
        Returns: string
      }
      admin_renew_membership: { Args: { p_member_id: string }; Returns: string }
      admin_set_active: {
        Args: { p_active: boolean; p_member_id: string }
        Returns: undefined
      }
      admin_set_partner_pin: {
        Args: { p_id: string; p_pin: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      admin_update_partner: {
        Args: { p_id: string; p_is_active: boolean; p_name: string }
        Returns: undefined
      }
      admin_void_redemption: {
        Args: { p_redemption_id: string }
        Returns: undefined
      }
      assert_admin: { Args: never; Returns: undefined }
      gen_code: { Args: { len: number }; Returns: string }
      get_member_card: { Args: { p_code: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      membership_status: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: string
      }
      my_coupons: { Args: never; Returns: Json }
      public_member_count: { Args: never; Returns: number }
      queue_expiry_notices: { Args: never; Returns: number }
      redeem_coupon: {
        Args: {
          p_coupon_id: string
          p_device_token?: string
          p_member_code: string
          p_pin?: string
          p_remember?: boolean
        }
        Returns: Json
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
