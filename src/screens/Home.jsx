import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { EmptyStateBody } from './EmptyStateBody.jsx';

export function Home({ onOpenSettings }) {
  return (
    <>
      <ScreenHeader title="Home" action={{ icon: 'menu', label: 'Settings', onClick: onOpenSettings }} />
      <EmptyStateBody
        title="Set up your budget"
        body="Onboarding is coming in the next update — once you split your income, Home will show your monthly summary, cumulative position, and quests here."
      />
    </>
  );
}
