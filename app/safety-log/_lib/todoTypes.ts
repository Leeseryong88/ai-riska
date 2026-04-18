/** Firestore `safety_manager_todos` 문서 */
export interface SafetyManagerTodo {
  id: string;
  managerId: string;
  title: string;
  done: boolean;
  sortOrder: number;
  note?: string;
  dueDate?: unknown; // Firestore Timestamp
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TodoFilter = 'all' | 'active' | 'done';
