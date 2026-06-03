import { Outlet } from 'react-router-dom';
import { ThemeToggle } from './app/layout/ThemeToggle';

export default function App() {
  return (
    <>
      <Outlet />
      <ThemeToggle />
    </>
  );
}
