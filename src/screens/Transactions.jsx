import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { EmptyStateBody } from './EmptyStateBody.jsx';

export function Transactions() {
  return (
    <>
      <ScreenHeader title="Transactions" />
      <EmptyStateBody title="No transactions this month." body="Tap + to log your first one." />
    </>
  );
}
