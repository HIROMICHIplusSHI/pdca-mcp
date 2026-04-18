export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'instructor';
}

export interface AuthConfig {
  api_url: string;
  token: string;
  user: User;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Report {
  id: number;
  report_date: string;
  learning_status: 'green' | 'yellow' | 'red';
  learning_plan: string | null;
  learning_do: string | null;
  learning_check: string | null;
  learning_action: string | null;
  curriculum_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportListResponse {
  reports: Report[];
  meta: { total: number };
}

export interface WeeklyGoalItem {
  id: number;
  content: string;
  position: number;
  progress: number;
  category_id: number | null;
  category_name: string | null;
}

export interface WeeklyGoal {
  id: number;
  week_start_date: string;
  week_end_date: string;
  completion_rate: number;
  items: WeeklyGoalItem[];
  created_at: string;
  updated_at: string;
}

export interface PlanCategory {
  id: number;
  name: string;
  estimated_hours: number;
  position: number;
  completed: boolean;
}

export interface Plan {
  course_id: number;
  course_name: string;
  start_date: string;
  target_completion_date: string | null;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  categories: PlanCategory[];
}

export interface Comment {
  id: number;
  content: string;
  user: { id: number; name: string; role: string };
  created_at: string;
}

export interface AiComment {
  content: string;
  created_at: string;
}

export interface StudentSummary {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  teams: string[];
  latest_report_date: string | null;
  course_names: string[];
}

export interface StudentDetail {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  teams: string[];
  courses: { id: number; name: string; status: string }[];
  latest_report_date: string | null;
  meeting_cycle_start_day: number | null;
}

export interface DashboardStudent {
  id: number;
  name: string;
  teams: string[];
  submitted: boolean;
  report: {
    id: number;
    learning_status: 'green' | 'yellow' | 'red';
    learning_plan: string;
    learning_do: string;
    learning_check: string;
    learning_action: string;
    comment_count: number;
  } | null;
}

export interface DashboardDailyResponse {
  date: string;
  summary: {
    total: number;
    submitted: number;
    not_submitted: number;
    green: number;
    yellow: number;
    red: number;
  };
  students: DashboardStudent[];
}

export interface ProgressStudent {
  id: number;
  name: string;
  teams: string[];
  courses: {
    id: number;
    name: string;
    completion_rate: number;
    completed_categories: number;
    total_categories: number;
  }[];
}

export interface ProgressDetail {
  student: { id: number; name: string };
  courses: {
    id: number;
    name: string;
    completion_rate: number;
    categories: {
      id: number;
      name: string;
      completed: boolean;
      position: number;
    }[];
  }[];
}

export interface ApiErrorResponse {
  error: string;
  status: number;
  details?: Record<string, string[]>;
}
