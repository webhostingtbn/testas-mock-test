export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown> = Partial<Row>,
  Update extends Record<string, unknown> = Partial<Row>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDefinition<{
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
        created_at: string;
        updated_at: string;
        module_test: string | null;
        role: string | null;
        phonenumber: string | null;
        allow_test_limit: number | null;
        status: string | null;
        format: string | null;
      }>;
      exams: TableDefinition<{
        id: string;
        title: string;
        description: string | null;
        major: string | null;
        is_active: boolean;
        created_at: string;
        retry_number: number | null;
        format: string | null;
      }>;
      sections: TableDefinition<{
        id: string;
        exam_id: string;
        title: string;
        description: string | null;
        question_type: string;
        duration_seconds: number;
        question_count: number;
        sort_order: number;
        environment_content: Json | null;
        created_at: string;
      }>;
      passages: TableDefinition<{
        id: string;
        section_id: string;
        title: string;
        body_markdown: string;
        image_url: string | null;
        sort_order: number;
      }>;
      questions: TableDefinition<{
        id: string;
        section_id: string;
        sort_order: number;
        question_type: string;
        content: Json;
        correct_answer?: Json;
        passage_id: string | null;
        created_at: string;
      }>;
      user_exams: TableDefinition<{
        id: string;
        user_id: string;
        exam_id: string;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        total_score: number | null;
        max_score: number | null;
        created_at: string;
        detailed_results: Json | null;
        user_answers: Json;
        updated_at: string;
      }>;
      user_question_practices: TableDefinition<{
        id: string;
        user_id: string;
        question_id: string;
        difficulty: 'easy' | 'medium' | 'hard';
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      create_attempt_transaction: {
        Args: {
          p_exam_id: string;
          p_user_id: string;
          p_attempt_limit: number | null;
        };
        Returns: Json;
      };
      submit_attempt_transaction: {
        Args: {
          p_attempt_id: string;
          p_user_id: string;
          p_user_answers: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
