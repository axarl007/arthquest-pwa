import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { EmptyStateBody } from './EmptyStateBody.jsx';

export function Quests({ onOpenNewQuest }) {
  return (
    <>
      <ScreenHeader title="Quests" action={{ icon: 'add', label: 'New quest', variant: 'quest', onClick: onOpenNewQuest }} />
      <EmptyStateBody title="No quests yet" body="Create a savings quest to start tracking a goal." />
    </>
  );
}
