import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/auth/AuthForm';
import { Navigate } from 'react-router-dom';

export default function Signup() {
  const { user, signUp } = useAuth();

  if (user) return <Navigate to="/" replace />;

  return <AuthForm mode="signup" onSubmit={signUp} />;
}
