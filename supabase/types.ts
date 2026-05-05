export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          legacy_id: string | null;
          auth_user_id: string | null;
          tenant_id: string | null;
          role:
            | "administrador-master"
            | "administrador"
            | "gestor-dados"
            | "gestor-fabrica"
            | "chao-fabrica"
            | "loja";
          status: "ativo" | "inativo";
          name: string;
          email: string;
          phone: string | null;
          zip_code: string | null;
          street: string | null;
          number: string | null;
          complement: string | null;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          avatar_path: string | null;
          password_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          auth_user_id?: string | null;
          tenant_id?: string | null;
          role:
            | "administrador-master"
            | "administrador"
            | "gestor-dados"
            | "gestor-fabrica"
            | "chao-fabrica"
            | "loja";
          status?: "ativo" | "inativo";
          name: string;
          email: string;
          phone?: string | null;
          zip_code?: string | null;
          street?: string | null;
          number?: string | null;
          complement?: string | null;
          neighborhood?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          avatar_path?: string | null;
          password_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      tenants: {
        Row: {
          id: string;
          legacy_id: string | null;
          slug: string;
          name: string;
          status: "ativo" | "inativo";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          slug: string;
          name: string;
          status?: "ativo" | "inativo";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
      };
      permission_modules: {
        Row: {
          id: string;
          module_key: string;
          label: string;
          route: string;
          group_key:
            | "administrador-master"
            | "administrador"
            | "gestor-dados"
            | "gestor-fabrica"
            | "chao-fabrica"
            | "loja";
          created_at: string;
        };
        Insert: {
          id?: string;
          module_key: string;
          label: string;
          route: string;
          group_key:
            | "administrador-master"
            | "administrador"
            | "gestor-dados"
            | "gestor-fabrica"
            | "chao-fabrica"
            | "loja";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["permission_modules"]["Insert"]>;
      };
      user_permissions: {
        Row: {
          id: string;
          tenant_id: string | null;
          profile_id: string;
          module_key: string;
          access_level: "sem_acesso" | "visualizar" | "operar" | "gerenciar";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          profile_id: string;
          module_key: string;
          access_level: "sem_acesso" | "visualizar" | "operar" | "gerenciar";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_permissions"]["Insert"]>;
      };
      profile_store_access: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          store_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          profile_id: string;
          store_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_store_access"]["Insert"]>;
      };
      operational_settings: {
        Row: {
          id: string;
          tenant_id: string;
          order_cutoff_time: string;
          expedition_lead_days: number;
          sale_lead_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          order_cutoff_time: string;
          expedition_lead_days: number;
          sale_lead_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["operational_settings"]["Insert"]>;
      };
      stores: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          name: string;
          responsible: string;
          responsible_profile_id: string | null;
          email: string;
          phone: string;
          status: "ativo" | "inativo";
          receive_window: string;
          ordering_days: string[];
          receiving_days: string[];
          ordering_blocked_days: string[];
          receiving_blocked_days: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          name: string;
          responsible: string;
          responsible_profile_id?: string | null;
          email: string;
          phone: string;
          status?: "ativo" | "inativo";
          receive_window: string;
          ordering_days?: string[];
          receiving_days?: string[];
          ordering_blocked_days?: string[];
          receiving_blocked_days?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          external_code: string | null;
          name: string;
          responsible: string;
          status: "ativo" | "inativo";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          external_code?: string | null;
          name: string;
          responsible: string;
          status?: "ativo" | "inativo";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      subcategories: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          external_code: string | null;
          name: string;
          category_id: string;
          type: string;
          operating_hours: string;
          capacity_per_day_kg: number;
          status: "ativo" | "inativo";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          external_code?: string | null;
          name: string;
          category_id: string;
          type: string;
          operating_hours: string;
          capacity_per_day_kg: number;
          status?: "ativo" | "inativo";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subcategories"]["Insert"]>;
      };
      schedule_lines: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          name: string;
          subcategory_id: string;
          revision_of_id: string | null;
          status: "pendente" | "ativo" | "inativo";
          created_at: string;
          created_by_profile_id: string | null;
          audited_at: string | null;
          audited_by_profile_id: string | null;
          audit_notes: string | null;
          deactivated_at: string | null;
          deactivated_by_profile_id: string | null;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          name: string;
          subcategory_id: string;
          revision_of_id?: string | null;
          status?: "pendente" | "ativo" | "inativo";
          created_at?: string;
          created_by_profile_id?: string | null;
          audited_at?: string | null;
          audited_by_profile_id?: string | null;
          audit_notes?: string | null;
          deactivated_at?: string | null;
          deactivated_by_profile_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["schedule_lines"]["Insert"]>;
      };
      schedule_line_item_snapshots: {
        Row: {
          id: string;
          tenant_id: string;
          schedule_line_id: string;
          product_id: string;
          minimum_production: number;
          production_days: string[];
          day_priorities: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          schedule_line_id: string;
          product_id: string;
          minimum_production: number;
          production_days?: string[];
          day_priorities?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["schedule_line_item_snapshots"]["Insert"]>;
      };
      ingredients: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          external_code: string | null;
          name: string;
          short_name: string | null;
          type: "puro" | "misturado";
          unit: string;
          purchase_unit: string | null;
          purchase_to_consumption_factor: number;
          metadata: string;
          observation: string;
          status: "ativo" | "inativo";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          external_code?: string | null;
          name: string;
          short_name?: string | null;
          type: "puro" | "misturado";
          unit: string;
          purchase_unit?: string | null;
          purchase_to_consumption_factor?: number;
          metadata?: string;
          observation?: string;
          status?: "ativo" | "inativo";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ingredients"]["Insert"]>;
      };
      ingredient_components: {
        Row: {
          id: string;
          tenant_id: string;
          ingredient_id: string;
          ingredient_reference_id: string | null;
          product_reference_id: string | null;
          name: string;
          quantity: number;
          unit: string;
          observation: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          ingredient_id: string;
          ingredient_reference_id?: string | null;
          product_reference_id?: string | null;
          name: string;
          quantity: number;
          unit: string;
          observation?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ingredient_components"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          external_code: string | null;
          name: string;
          short_name: string | null;
          description: string;
          subcategory_id: string;
          operational_subcategory_id: string | null;
          active: boolean;
          available_for_ordering: boolean;
          validity_days: number;
          minimum_production_kg: number;
          economic_production_kg: number;
          allows_storage: boolean;
          production_days: string[];
          sale_lead_days: number;
          expedition_lead_days: number;
          unit_profiles: Json;
          packaging_profile: Json | null;
          is_sold_loose: boolean;
          preparation_mode: string;
          break_percent: number;
          break_stage: "antes_divisao" | "depois_divisao" | "antes_forno" | "depois_forno";
          break_comment: string;
          can_be_ingredient: boolean;
          ingredient_profile: Json | null;
          weight_label: string;
          production_unit: string;
          sales_unit: string;
          sales_to_kg_factor: number;
          expedition_unit: string;
          expedition_to_kg_factor: number;
          is_mpi_ingredient: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          external_code?: string | null;
          name: string;
          short_name?: string | null;
          description?: string;
          subcategory_id: string;
          operational_subcategory_id?: string | null;
          active?: boolean;
          available_for_ordering?: boolean;
          validity_days?: number;
          minimum_production_kg?: number;
          economic_production_kg?: number;
          allows_storage?: boolean;
          production_days?: string[];
          sale_lead_days?: number;
          expedition_lead_days?: number;
          unit_profiles: Json;
          packaging_profile?: Json | null;
          is_sold_loose?: boolean;
          preparation_mode?: string;
          break_percent?: number;
          break_stage?: "antes_divisao" | "depois_divisao" | "antes_forno" | "depois_forno";
          break_comment?: string;
          can_be_ingredient?: boolean;
          ingredient_profile?: Json | null;
          weight_label?: string;
          production_unit: string;
          sales_unit: string;
          sales_to_kg_factor?: number;
          expedition_unit: string;
          expedition_to_kg_factor?: number;
          is_mpi_ingredient?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      product_recipe_items: {
        Row: {
          id: string;
          tenant_id: string;
          product_id: string;
          source_type: "ingrediente" | "produto";
          ingredient_source_id: string | null;
          product_source_id: string | null;
          label: string;
          quantity: number;
          unit: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          product_id: string;
          source_type: "ingrediente" | "produto";
          ingredient_source_id?: string | null;
          product_source_id?: string | null;
          label: string;
          quantity: number;
          unit: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_recipe_items"]["Insert"]>;
      };
      product_preparation_steps: {
        Row: {
          id: string;
          tenant_id: string;
          product_id: string;
          stage_key: "em_preparacao" | "em_producao" | "em_forno" | "embalando";
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          product_id: string;
          stage_key: "em_preparacao" | "em_producao" | "em_forno" | "embalando";
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_preparation_steps"]["Insert"]>;
      };
      product_changelog: {
        Row: {
          id: string;
          tenant_id: string;
          product_id: string;
          version_number: number;
          change_description: string;
          changed_by_profile_id: string | null;
          changed_by_name: string;
          snapshot_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          product_id: string;
          version_number: number;
          change_description: string;
          changed_by_profile_id?: string | null;
          changed_by_name?: string;
          snapshot_data?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_changelog"]["Insert"]>;
      };
      production_line_types: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          status: "ativo" | "inativo";
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          status?: "ativo" | "inativo";
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["production_line_types"]["Insert"]>;
      };
      store_orders: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          store_id: string;
          created_by_profile_id: string | null;
          ordered_at: string;
          base_date: string;
          delivery_date: string;
          receive_window_snapshot: string;
          expedition_lead_days_snapshot: number;
          note: string;
          management_status: string;
          cancelled_at: string | null;
          cancelled_by_profile_id: string | null;
          reopened_at: string | null;
          reopened_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          store_id: string;
          created_by_profile_id?: string | null;
          ordered_at: string;
          base_date: string;
          delivery_date: string;
          receive_window_snapshot: string;
          expedition_lead_days_snapshot: number;
          note?: string;
          management_status?: string;
          cancelled_at?: string | null;
          cancelled_by_profile_id?: string | null;
          reopened_at?: string | null;
          reopened_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["store_orders"]["Insert"]>;
      };
      store_order_items: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          order_id: string;
          product_id: string;
          product_code_snapshot: string;
          product_name_snapshot: string;
          requested_quantity: number;
          requested_unit: string;
          sales_to_kg_factor_snapshot: number;
          internal_kg_snapshot: number;
          expedition_unit_snapshot: string;
          expedition_to_kg_factor_snapshot: number;
          operational_unit_snapshot: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          order_id: string;
          product_id: string;
          product_code_snapshot: string;
          product_name_snapshot: string;
          requested_quantity: number;
          requested_unit: string;
          sales_to_kg_factor_snapshot: number;
          internal_kg_snapshot: number;
          expedition_unit_snapshot: string;
          expedition_to_kg_factor_snapshot: number;
          operational_unit_snapshot: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["store_order_items"]["Insert"]>;
      };
      workflow_order_releases: {
        Row: {
          id: string;
          tenant_id: string;
          order_id: string;
          released_at: string;
          released_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          order_id: string;
          released_at?: string;
          released_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_order_releases"]["Insert"]>;
      };
      workflow_production_items: {
        Row: {
          id: string;
          tenant_id: string;
          production_item_key: string;
          status: "nao_iniciado" | "em_preparacao" | "em_producao" | "em_forno" | "embalando" | "concluido";
          progress: number;
          updated_at: string;
          updated_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          production_item_key: string;
          status?: "nao_iniciado" | "em_preparacao" | "em_producao" | "em_forno" | "embalando" | "concluido";
          progress?: number;
          updated_at?: string;
          updated_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_production_items"]["Insert"]>;
      };
      delivery_executions: {
        Row: {
          id: string;
          tenant_id: string;
          order_id: string;
          status: "aguardando_expedicao" | "pronto_coleta" | "em_rota" | "no_destino" | "entregue" | "tentativa_falha";
          checklist_state: Json;
          checklist_completed_at: string | null;
          updated_at: string;
          updated_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          order_id: string;
          status?: "aguardando_expedicao" | "pronto_coleta" | "em_rota" | "no_destino" | "entregue" | "tentativa_falha";
          checklist_state?: Json;
          checklist_completed_at?: string | null;
          updated_at?: string;
          updated_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["delivery_executions"]["Insert"]>;
      };
      store_occurrences: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          order_id: string;
          order_item_id: string | null;
          product_id: string | null;
          product_name_snapshot: string;
          problem_type: string;
          quantity_type: "percentual" | "kg" | "operacional";
          quantity: number;
          quantity_unit_snapshot: string;
          description: string;
          status: "aberta" | "em_analise" | "resolvida" | "fechada";
          opened_by_profile_id: string | null;
          resolved_by_profile_id: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          order_id: string;
          order_item_id?: string | null;
          product_id?: string | null;
          product_name_snapshot: string;
          problem_type: string;
          quantity_type: "percentual" | "kg" | "operacional";
          quantity: number;
          quantity_unit_snapshot: string;
          description: string;
          status?: "aberta" | "em_analise" | "resolvida" | "fechada";
          opened_by_profile_id?: string | null;
          resolved_by_profile_id?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["store_occurrences"]["Insert"]>;
      };
      tenant_support_occurrences: {
        Row: {
          id: string;
          legacy_id: string | null;
          tenant_id: string;
          code: string;
          title: string;
          category:
            | "cadastro"
            | "usuarios"
            | "acesso"
            | "financeiro"
            | "operacao"
            | "outro";
          priority: "baixa" | "media" | "alta";
          description: string;
          status:
            | "aberta"
            | "em_analise"
            | "aguardando_cliente"
            | "resolvida"
            | "fechada";
          opened_by_profile_id: string | null;
          assigned_to_profile_id: string | null;
          last_message_at: string;
          resolved_at: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          tenant_id: string;
          code: string;
          title: string;
          category?:
            | "cadastro"
            | "usuarios"
            | "acesso"
            | "financeiro"
            | "operacao"
            | "outro";
          priority?: "baixa" | "media" | "alta";
          description: string;
          status?:
            | "aberta"
            | "em_analise"
            | "aguardando_cliente"
            | "resolvida"
            | "fechada";
          opened_by_profile_id?: string | null;
          assigned_to_profile_id?: string | null;
          last_message_at?: string;
          resolved_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["tenant_support_occurrences"]["Insert"]
        >;
      };
      tenant_support_occurrence_events: {
        Row: {
          id: string;
          tenant_id: string;
          occurrence_id: string;
          event_type: string;
          author_scope: "cliente" | "master" | "sistema";
          content: string;
          created_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          occurrence_id: string;
          event_type: string;
          author_scope?: "cliente" | "master" | "sistema";
          content: string;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["tenant_support_occurrence_events"]["Insert"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
