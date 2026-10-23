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
      activities: {
        Row: {
          capacity: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          ends_at: string | null
          id: string
          image_url: string | null
          location: string
          mode: string
          registration_closes_at: string | null
          starts_at: string
          status: string
          team_max: number | null
          team_min: number | null
          title: string
          updated_at: string
        }
        Insert: {
          capacity: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          location?: string
          mode?: string
          registration_closes_at?: string | null
          starts_at: string
          status?: string
          team_max?: number | null
          team_min?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          location?: string
          mode?: string
          registration_closes_at?: string | null
          starts_at?: string
          status?: string
          team_max?: number | null
          team_min?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_participants: {
        Row: {
          activity_id: string
          added_at: string
          checked_in_at: string | null
          checked_in_by: string | null
          is_captain: boolean
          member_id: string
          registration_id: string
        }
        Insert: {
          activity_id: string
          added_at?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          is_captain?: boolean
          member_id: string
          registration_id: string
        }
        Update: {
          activity_id?: string
          added_at?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          is_captain?: boolean
          member_id?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "admin_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "activity_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_registrations: {
        Row: {
          activity_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          captain_id: string | null
          created_at: string
          id: string
          status: string
          team_name: string | null
        }
        Insert: {
          activity_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          captain_id?: string | null
          created_at?: string
          id?: string
          status?: string
          team_name?: string | null
        }
        Update: {
          activity_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          captain_id?: string | null
          created_at?: string
          id?: string
          status?: string
          team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_registrations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registrations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "admin_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registrations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registrations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registrations_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registrations_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_applications: {
        Row: {
          admin_note: string | null
          created_at: string
          experience: string | null
          id: string
          member_id: string
          motivation: string
          reviewed_at: string | null
          reviewed_by: string | null
          social: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          experience?: string | null
          id?: string
          member_id: string
          motivation: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          experience?: string | null
          id?: string
          member_id?: string
          motivation?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: number
          launch_hold: boolean
          new_member_days: number
          notify_email: string
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
          notify_email?: string
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
          notify_email?: string
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
          image_url: string | null
          partner_id: string
          quantity: number
          title: string
          value_sar: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          partner_id: string
          quantity: number
          title: string
          value_sar: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
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
          ambassador_since: string | null
          created_at: string
          district: string
          email: string
          expires_at: string
          full_name: string
          id: string
          is_active: boolean
          is_ambassador: boolean
          is_trial: boolean
          joined_at: string
          member_code: string
          member_no: number
          notes: string | null
          phone: string
          photo_url: string | null
          referral_code: string | null
          referred_by: string | null
          role: string
          study_year: string
          university: string
        }
        Insert: {
          ambassador_since?: string | null
          created_at?: string
          district: string
          email: string
          expires_at?: string
          full_name: string
          id: string
          is_active?: boolean
          is_ambassador?: boolean
          is_trial?: boolean
          joined_at?: string
          member_code?: string
          member_no?: number
          notes?: string | null
          phone: string
          photo_url?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          study_year: string
          university: string
        }
        Update: {
          ambassador_since?: string | null
          created_at?: string
          district?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_ambassador?: boolean
          is_trial?: boolean
          joined_at?: string
          member_code?: string
          member_no?: number
          notes?: string | null
          phone?: string
          photo_url?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          study_year?: string
          university?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      service_requests: {
        Row: {
          channel: string
          created_at: string
          id: string
          member_id: string
          service_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          member_id: string
          service_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          member_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "admin_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          ask_location: boolean
          created_at: string
          email: string | null
          features_ar: string[]
          features_en: string[]
          how_ar: string
          how_en: string
          icon: string
          id: string
          image_url: string | null
          is_published: boolean
          message_ar: string
          message_en: string
          page: string | null
          slug: string | null
          sort_order: number
          summary_ar: string
          summary_en: string
          title_ar: string
          title_en: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ask_location?: boolean
          created_at?: string
          email?: string | null
          features_ar?: string[]
          features_en?: string[]
          how_ar?: string
          how_en?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          message_ar?: string
          message_en?: string
          page?: string | null
          slug?: string | null
          sort_order?: number
          summary_ar?: string
          summary_en?: string
          title_ar: string
          title_en?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ask_location?: boolean
          created_at?: string
          email?: string | null
          features_ar?: string[]
          features_en?: string[]
          how_ar?: string
          how_en?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          message_ar?: string
          message_en?: string
          page?: string | null
          slug?: string | null
          sort_order?: number
          summary_ar?: string
          summary_en?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_activities: {
        Row: {
          cancelled: number | null
          capacity: number | null
          category: string | null
          checked_in: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string | null
          image_url: string | null
          location: string | null
          mode: string | null
          participants: number | null
          registration_closes_at: string | null
          starts_at: string | null
          state: string | null
          status: string | null
          taken: number | null
          team_max: number | null
          team_min: number | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_roster: {
        Row: {
          activity_id: string | null
          added_at: string | null
          checked_in_at: string | null
          checked_in_by_name: string | null
          email: string | null
          full_name: string | null
          is_captain: boolean | null
          member_id: string | null
          member_label: string | null
          member_status: string | null
          phone: string | null
          registered_at: string | null
          registration_id: string | null
          team_name: string | null
          university: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "admin_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "activity_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_ambassador_applications: {
        Row: {
          admin_note: string | null
          created_at: string | null
          email: string | null
          experience: string | null
          full_name: string | null
          id: string | null
          is_ambassador: boolean | null
          member_id: string | null
          member_label: string | null
          member_status: string | null
          motivation: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          social: string | null
          status: string | null
          study_year: string | null
          university: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_batches: {
        Row: {
          assigned: number | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          image_url: string | null
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
          ambassador_since: string | null
          coupons_available: number | null
          coupons_redeemed: number | null
          created_at: string | null
          district: string | null
          email: string | null
          expires_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          is_ambassador: boolean | null
          is_trial: boolean | null
          joined_at: string | null
          member_code: string | null
          member_label: string | null
          member_no: number | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          referral_code: string | null
          referrals: number | null
          referred_by: string | null
          referred_by_name: string | null
          role: string | null
          status: string | null
          study_year: string | null
          university: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      admin_service_requests: {
        Row: {
          channel: string | null
          created_at: string | null
          id: string | null
          member_id: string | null
          member_name: string | null
          member_no: number | null
          service_id: string | null
          service_title: string | null
          university: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "admin_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_services: {
        Row: {
          ask_location: boolean | null
          created_at: string | null
          email: string | null
          features_ar: string[] | null
          features_en: string[] | null
          how_ar: string | null
          how_en: string | null
          icon: string | null
          id: string | null
          image_url: string | null
          is_published: boolean | null
          message_ar: string | null
          message_en: string | null
          page: string | null
          requests_30d: number | null
          requests_total: number | null
          slug: string | null
          sort_order: number | null
          summary_ar: string | null
          summary_en: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          ask_location?: boolean | null
          created_at?: string | null
          email?: string | null
          features_ar?: string[] | null
          features_en?: string[] | null
          how_ar?: string | null
          how_en?: string | null
          icon?: string | null
          id?: string | null
          image_url?: string | null
          is_published?: boolean | null
          message_ar?: string | null
          message_en?: string | null
          page?: string | null
          requests_30d?: never
          requests_total?: never
          slug?: string | null
          sort_order?: number | null
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          ask_location?: boolean | null
          created_at?: string | null
          email?: string | null
          features_ar?: string[] | null
          features_en?: string[] | null
          how_ar?: string | null
          how_en?: string | null
          icon?: string | null
          id?: string | null
          image_url?: string | null
          is_published?: boolean | null
          message_ar?: string | null
          message_en?: string | null
          page?: string | null
          requests_30d?: never
          requests_total?: never
          slug?: string | null
          sort_order?: number | null
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activity_state: {
        Args: {
          a: Database["public"]["Tables"]["activities"]["Row"]
          taken: number
        }
        Returns: string
      }
      activity_taken: { Args: { p_activity_id: string }; Returns: number }
      activity_vars: {
        Args: { a: Database["public"]["Tables"]["activities"]["Row"] }
        Returns: Json
      }
      admin_assign_coupons: {
        Args: { p_batch_id: string; p_member_ids: string[] }
        Returns: number
      }
      admin_cancel_activity: {
        Args: { p_activity_id: string; p_notify?: boolean }
        Returns: undefined
      }
      admin_cancel_registration: {
        Args: { p_notify?: boolean; p_registration_id: string }
        Returns: undefined
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
      admin_review_ambassador: {
        Args: { p_application_id: string; p_approve: boolean; p_note?: string }
        Returns: undefined
      }
      admin_set_active: {
        Args: { p_active: boolean; p_member_id: string }
        Returns: undefined
      }
      admin_set_ambassador: {
        Args: { p_member_id: string; p_on: boolean }
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
      apply_ambassador: {
        Args: { p_experience?: string; p_motivation: string; p_social?: string }
        Returns: Json
      }
      assert_admin: { Args: never; Returns: undefined }
      checkin_activities: { Args: never; Returns: Json }
      checkin_open: {
        Args: { a: Database["public"]["Tables"]["activities"]["Row"] }
        Returns: boolean
      }
      checkin_roster: { Args: { p_activity_id: string }; Returns: Json }
      find_teammate: {
        Args: { p_activity_id: string; p_member_no: string }
        Returns: Json
      }
      gen_code: { Args: { len: number }; Returns: string }
      get_member_card: { Args: { p_code: string }; Returns: Json }
      grant_ambassador: { Args: { p_member_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_ambassador: { Args: never; Returns: boolean }
      leave_activity: { Args: { p_registration_id: string }; Returns: Json }
      list_activities: { Args: never; Returns: Json }
      list_services: { Args: never; Returns: Json }
      log_service_request: {
        Args: { p_channel: string; p_service_id: string }
        Returns: undefined
      }
      member_checkins: { Args: { p_member_code: string }; Returns: Json }
      member_is_active: { Args: never; Returns: boolean }
      member_label: { Args: { n: number }; Returns: string }
      membership_status: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: string
      }
      my_ambassador: { Args: never; Returns: Json }
      my_coupons: { Args: never; Returns: Json }
      public_member_count: { Args: never; Returns: number }
      queue_activity_reminders: { Args: never; Returns: number }
      queue_admin_email: {
        Args: { p_kind: string; p_vars: Json }
        Returns: undefined
      }
      queue_expiry_notices: { Args: never; Returns: number }
      queue_member_email: {
        Args: { p_kind: string; p_member_ids: string[]; p_vars: Json }
        Returns: undefined
      }
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
      register_activity: {
        Args: {
          p_activity_id: string
          p_member_nos?: string[]
          p_team_name?: string
        }
        Returns: Json
      }
      resolve_team: {
        Args: {
          a: Database["public"]["Tables"]["activities"]["Row"]
          me: Database["public"]["Tables"]["profiles"]["Row"]
          p_member_nos: string[]
          p_registration_id: string
        }
        Returns: Json
      }
      set_checkin: {
        Args: { p_activity_id: string; p_checked: boolean; p_member_id: string }
        Returns: Json
      }
      update_team: {
        Args: { p_member_nos: string[]; p_registration_id: string }
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
