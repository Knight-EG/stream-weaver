import { useNavigate } from 'react-router-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  return (
    <AuthForm
      mode="login"
      onSubmit={async (email, password) => {
        const result = await signIn(email, password);
        if (!result.error) navigate('/');
        return result;
      }}
      onForgotPassword={() => navigate('/forgot-password')}
    />
  );
}
