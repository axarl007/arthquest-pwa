import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { EmptyStateBody } from './EmptyStateBody.jsx';

export function Budget({ onOpenActions }) {
  return (
    <>
      <ScreenHeader title="Budget" action={{ icon: 'add', label: 'Budget actions', onClick: onOpenActions }} />
      <EmptyStateBody
        title="No budget yet"
        body="Once you set up your income split, your budget categories and spend will show up here."
      />
    </>
  );
}
