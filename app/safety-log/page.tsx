import { redirect } from 'next/navigation';

export default function SafetyLogPage() {
  redirect('/safety-log/daily');
}
