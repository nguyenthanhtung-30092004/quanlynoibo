import { LoginForm } from '@/features/auth/components/LoginForm';
import './login.css';

const CUBES = [
  { s: 54, d: '22s', t: '12%', l: '10%' },
  { s: 34, d: '16s', t: '70%', l: '8%' },
  { s: 70, d: '28s', t: '18%', l: '82%' },
  { s: 40, d: '19s', t: '76%', l: '86%' },
  { s: 26, d: '14s', t: '42%', l: '92%' },
  { s: 30, d: '17s', t: '8%', l: '48%' },
];

export default function LoginPage() {
  return (
    <main className="lg-root">
      <div className="lg-orb a" />
      <div className="lg-orb b" />
      <div className="lg-orb c" />
      <div className="lg-grid" />
      {CUBES.map((c, i) => (
        <div
          key={i}
          className="lg-cube"
          style={{ ['--s' as string]: `${c.s}px`, ['--d' as string]: c.d, top: c.t, left: c.l }}
        >
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      ))}
      <LoginForm />
      <div className="lg-foot">© Hệ thống điều hành đặt xe nội bộ</div>
    </main>
  );
}
