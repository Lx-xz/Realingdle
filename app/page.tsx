import Link from 'next/link';
import Button from '@/components/Button';
import './page.css';

export default function Home() {
  return (
    <div className="home">
      <main className="home__content">
        <h1 className="home__title">Realingdle</h1>
        <p className="home__subtitle">
          Guess the character from Realing RPG universe
        </p>
        <Link href="/game">
          <Button>Play Game</Button>
        </Link>
      </main>
    </div>
  );
}
