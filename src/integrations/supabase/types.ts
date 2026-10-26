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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      app_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          key: string
          label: string
          updated_at: string
          updated_by: string | null
          value: Json
          value_type: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
          value: Json
          value_type?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string
        }
        Relationships: []
      }
      city_codes: {
        Row: {
          city: string
          city_norm: string
          code: string
          created_at: string
          id: string
          state: string
        }
        Insert: {
          city: string
          city_norm: string
          code: string
          created_at?: string
          id?: string
          state: string
        }
        Update: {
          city?: string
          city_norm?: string
          code?: string
          created_at?: string
          id?: string
          state?: string
        }
        Relationships: []
      }
      cobertura_movel_meta: {
        Row: {
          carregado_em: string
          fonte_publicada_em: string | null
          id: number
          periodo: string
        }
        Insert: {
          carregado_em?: string
          fonte_publicada_em?: string | null
          id?: number
          periodo: string
        }
        Update: {
          carregado_em?: string
          fonte_publicada_em?: string | null
          id?: number
          periodo?: string
        }
        Relationships: []
      }
      cobertura_movel_municipio: {
        Row: {
          area_km2: number | null
          cod_ibge: number
          moradores: number | null
          municipio: string
          municipio_norm: string
          operadora: string
          pct_area: number
          pct_domicilios: number
          pct_moradores: number
          periodo: string
          tecnologia: string
          uf: string
        }
        Insert: {
          area_km2?: number | null
          cod_ibge: number
          moradores?: number | null
          municipio: string
          municipio_norm: string
          operadora: string
          pct_area?: number
          pct_domicilios?: number
          pct_moradores?: number
          periodo: string
          tecnologia: string
          uf: string
        }
        Update: {
          area_km2?: number | null
          cod_ibge?: number
          moradores?: number | null
          municipio?: string
          municipio_norm?: string
          operadora?: string
          pct_area?: number
          pct_domicilios?: number
          pct_moradores?: number
          periodo?: string
          tecnologia?: string
          uf?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          active: boolean
          code: string
          created_at: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      country_cities: {
        Row: {
          active: boolean
          country_code: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          country_code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "country_cities_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      equipment_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          full_name: string | null
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_equipments: {
        Row: {
          created_at: string
          equipment_type_id: string
          id: string
          project_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          equipment_type_id: string
          id?: string
          project_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          equipment_type_id?: string
          id?: string
          project_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_equipments_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_equipments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_history: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          project_id: string
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          project_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          project_id?: string
        }
        Relationships: []
      }
      project_integrations: {
        Row: {
          id: string
          integration_id: string
          project_id: string
        }
        Insert: {
          id?: string
          integration_id: string
          project_id: string
        }
        Update: {
          id?: string
          integration_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_integrations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_note_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_content: string | null
          note_created_by: string | null
          note_id: string
          old_content: string
          project_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_content?: string | null
          note_created_by?: string | null
          note_id: string
          old_content: string
          project_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_content?: string | null
          note_created_by?: string | null
          note_id?: string
          old_content?: string
          project_id?: string
        }
        Relationships: []
      }
      project_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_products: {
        Row: {
          id: string
          product_id: string
          project_id: string
        }
        Insert: {
          id?: string
          product_id: string
          project_id: string
        }
        Update: {
          id?: string
          product_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_solution_features: {
        Row: {
          created_at: string
          id: string
          project_id: string
          solution_feature_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          solution_feature_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          solution_feature_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_solution_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_solution_features_solution_feature_id_fkey"
            columns: ["solution_feature_id"]
            isOneToOne: false
            referencedRelation: "solution_features"
            referencedColumns: ["id"]
          },
        ]
      }
      project_solutions: {
        Row: {
          id: string
          project_id: string
          solution_id: string
        }
        Insert: {
          id?: string
          project_id: string
          solution_id: string
        }
        Update: {
          id?: string
          project_id?: string
          solution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_solutions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_solutions_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          short_code: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          short_code: string
          tenant_id?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          short_code?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          atlas_pay: boolean
          city: string
          client_manager_name: string | null
          cnpj: string | null
          company_name: string
          complementary_fleet: number
          complementary_sale: boolean
          contract_date: string
          contractual_deadline_days: number | null
          country_code: string
          created_at: string
          created_by: string | null
          d_zero_date: string | null
          embedded_install_training: boolean | null
          executive_id: string | null
          executive_project_date: string | null
          filled_by: string | null
          fleet_seccionado: number
          fleet_size: number | null
          fleet_urbano: number
          handover_date: string | null
          id: string
          implementation_deadline_days: number | null
          implemented_fleet: number
          installation_client: number
          installation_transmobile: number
          is_pilot: boolean
          manager_id: string | null
          observations: string | null
          pilot_info: string | null
          project_code: string | null
          project_segment: string | null
          project_type_id: string | null
          reached_implemented: boolean
          reached_implemented_at: string | null
          reserve_fleet: number
          state: Database["public"]["Enums"]["brazilian_state"] | null
          status: Database["public"]["Enums"]["project_status"]
          sub_phase: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          atlas_pay?: boolean
          city: string
          client_manager_name?: string | null
          cnpj?: string | null
          company_name: string
          complementary_fleet?: number
          complementary_sale?: boolean
          contract_date: string
          contractual_deadline_days?: number | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          d_zero_date?: string | null
          embedded_install_training?: boolean | null
          executive_id?: string | null
          executive_project_date?: string | null
          filled_by?: string | null
          fleet_seccionado?: number
          fleet_size?: number | null
          fleet_urbano?: number
          handover_date?: string | null
          id?: string
          implementation_deadline_days?: number | null
          implemented_fleet?: number
          installation_client?: number
          installation_transmobile?: number
          is_pilot?: boolean
          manager_id?: string | null
          observations?: string | null
          pilot_info?: string | null
          project_code?: string | null
          project_segment?: string | null
          project_type_id?: string | null
          reached_implemented?: boolean
          reached_implemented_at?: string | null
          reserve_fleet?: number
          state?: Database["public"]["Enums"]["brazilian_state"] | null
          status?: Database["public"]["Enums"]["project_status"]
          sub_phase?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          atlas_pay?: boolean
          city?: string
          client_manager_name?: string | null
          cnpj?: string | null
          company_name?: string
          complementary_fleet?: number
          complementary_sale?: boolean
          contract_date?: string
          contractual_deadline_days?: number | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          d_zero_date?: string | null
          embedded_install_training?: boolean | null
          executive_id?: string | null
          executive_project_date?: string | null
          filled_by?: string | null
          fleet_seccionado?: number
          fleet_size?: number | null
          fleet_urbano?: number
          handover_date?: string | null
          id?: string
          implementation_deadline_days?: number | null
          implemented_fleet?: number
          installation_client?: number
          installation_transmobile?: number
          is_pilot?: boolean
          manager_id?: string | null
          observations?: string | null
          pilot_info?: string | null
          project_code?: string | null
          project_segment?: string | null
          project_type_id?: string | null
          reached_implemented?: boolean
          reached_implemented_at?: string | null
          reserve_fleet?: number
          state?: Database["public"]["Enums"]["brazilian_state"] | null
          status?: Database["public"]["Enums"]["project_status"]
          sub_phase?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_executive_id_fkey"
            columns: ["executive_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_imp_files: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          project_id: string
          uploaded_by: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          project_id: string
          uploaded_by?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          project_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_imp_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      role_presets: {
        Row: {
          created_at: string
          permissions: Json
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          permissions?: Json
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      solution_features: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          solution_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          solution_id: string
          sort_order?: number
          tenant_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          solution_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solution_features_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solution_features_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solutions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solutions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          role: string
          tenant_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          accent_color: string | null
          created_at: string
          logo_url: string | null
          portal_name: string | null
          primary_color: string | null
          sidebar_color: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          logo_url?: string | null
          portal_name?: string | null
          primary_color?: string | null
          sidebar_color?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          logo_url?: string | null
          portal_name?: string | null
          primary_color?: string | null
          sidebar_color?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activated_at: string | null
          blocked_reason: string | null
          created_at: string
          features: Json
          id: string
          name: string
          slug: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          features?: Json
          id?: string
          name: string
          slug: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          features?: Json
          id?: string
          name?: string
          slug?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          permissions: Json
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          permissions?: Json
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          permissions?: Json
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _compute_city_sigla: {
        Args: { p_city: string; p_persist: boolean; p_state: string }
        Returns: string
      }
      admin_get_team_emails: {
        Args: never
        Returns: {
          active: boolean
          email: string
          full_name: string
          id: string
          role: string
        }[]
      }
      can_view_project: { Args: { _project_id: string }; Returns: boolean }
      can_write_project: { Args: { _project_id: string }; Returns: boolean }
      code_token: { Args: { p: string }; Returns: string }
      current_user_email: { Args: never; Returns: string }
      generate_project_code: {
        Args: {
          p_city: string
          p_company_name: string
          p_country?: string
          p_project_type_id: string
          p_segment: string
          p_state: string
        }
        Returns: string
      }
      get_effective_permissions: { Args: { _user_id: string }; Returns: Json }
      get_my_manager_id: { Args: never; Returns: string }
      get_my_tenant_id: { Args: never; Returns: string }
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_public_tenant_branding: {
        Args: { _slug: string }
        Returns: {
          accent_color: string
          logo_url: string
          portal_name: string
          primary_color: string
          sidebar_color: string
          slug: string
          status: string
        }[]
      }
      get_user_scope: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: {
          _action: string
          _module: string
          _section?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_project_scope: { Args: never; Returns: string }
      norm_text: { Args: { p: string }; Returns: string }
      preview_project_code: {
        Args: {
          p_city: string
          p_company_name: string
          p_country?: string
          p_project_type_id: string
          p_segment: string
          p_state: string
        }
        Returns: string
      }
      resolve_city_code: {
        Args: { p_city: string; p_state: string }
        Returns: string
      }
      segment_code: { Args: { p_segment: string }; Returns: string }
      tenant_guard: { Args: { _tenant_id: string }; Returns: boolean }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "super_admin"
        | "integration"
        | "gerente_projetos"
        | "executivo"
        | "comercial"
        | "leitor"
        | "diretoria"
        | "projetos"
        | "suporte_tecnico"
        | "relacionamento"
        | "implantacao"
        | "produtos"
        | "desenvolvimento"
      brazilian_state:
        | "AC"
        | "AL"
        | "AP"
        | "AM"
        | "BA"
        | "CE"
        | "DF"
        | "ES"
        | "GO"
        | "MA"
        | "MT"
        | "MS"
        | "MG"
        | "PA"
        | "PB"
        | "PR"
        | "PE"
        | "PI"
        | "RJ"
        | "RN"
        | "RS"
        | "RO"
        | "RR"
        | "SC"
        | "SP"
        | "SE"
        | "TO"
      project_status:
        | "comercial"
        | "planejamento"
        | "implantacao"
        | "encerrado"
        | "suspenso"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "admin",
        "user",
        "super_admin",
        "integration",
        "gerente_projetos",
        "executivo",
        "comercial",
        "leitor",
        "diretoria",
        "projetos",
        "suporte_tecnico",
        "relacionamento",
        "implantacao",
        "produtos",
        "desenvolvimento",
      ],
      brazilian_state: [
        "AC",
        "AL",
        "AP",
        "AM",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MT",
        "MS",
        "MG",
        "PA",
        "PB",
        "PR",
        "PE",
        "PI",
        "RJ",
        "RN",
        "RS",
        "RO",
        "RR",
        "SC",
        "SP",
        "SE",
        "TO",
      ],
      project_status: [
        "comercial",
        "planejamento",
        "implantacao",
        "encerrado",
        "suspenso",
      ],
    },
  },
} as const
