import { useSeoMeta } from '@unhead/react';

const Index = () => {
  useSeoMeta({
    title: 'Shakespeare - AI-Powered Nostr Development',
    description: 'Build custom Nostr websites with AI assistance using Shakespeare, an AI-powered development environment.',
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Shakespeare
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
          AI-Powered Nostr Development
        </p>
        <p className="text-lg text-gray-500 dark:text-gray-500">
          Build custom Nostr websites with AI assistance
        </p>
      </div>
    </div>
  );
};

export default Index;
