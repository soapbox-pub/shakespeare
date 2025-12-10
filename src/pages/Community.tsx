import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  Calendar,
  Award,
  MapPin,
  Video,
  BookOpen,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Megaphone,
  MessageSquare,
  GitBranch,
  Lightbulb,
  Image,
  LifeBuoy,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { NoteContent } from '@/components/NoteContent';
import { ShakespeareLogo } from '@/components/ShakespeareLogo';
import { useAuthor } from '@/hooks/useAuthor';
import {
  useShakespeareFeed,
  useCommunityEvents,
  extractCalendarEventData,
  formatEventDate,
} from '@/hooks/useCommunity';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { genUserName } from '@/lib/genUserName';

// Stock images for cards (to be replaced later)
const STOCK_IMAGES = {
  chat: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
  events: 'https://soapbox.pub/assets/blog/shakespeare-workshop-guide/derek-shakespeare-workshop.jpeg',
  ambassador: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&q=80',
  workshop: 'https://soapbox.pub/assets/press/satsconf-brazil-2025/alex-workshop.jpeg',
};

// FAQs from soapbox.pub/shakespeare-resources
const FAQS = [
  {
    question: 'What is Shakespeare and how does it work?',
    answer:
      'Shakespeare is an AI-powered website builder that lets you create custom websites by chatting with AI. Simply describe what you want to build, and AI will code, design, and deploy your site for you.',
  },
  {
    question: 'Do I need coding experience to use Shakespeare?',
    answer:
      'No coding experience required! Shakespeare is designed for everyone. Just describe your ideas in plain language and let the AI handle the technical details.',
  },
  {
    question: 'How much does Shakespeare cost?',
    answer:
      'Shakespeare uses a pay-as-you-go credit system through NSPs (Nostr Service Providers). You only pay for what you use, with no monthly subscriptions required.',
  },
  {
    question: 'Can I download my website\'s source code?',
    answer:
      'Yes! You can download your complete project source code at any time. You own everything you create.',
  },
  {
    question: 'Where can I get help if I\'m stuck?',
    answer:
      'Join Shakespeare Chat at chat.shakespeare.diy to connect with other builders, get help from the community, and share what you\'re building!',
  },
];

// Featured blog posts
const BLOG_POSTS = [
  {
    title: 'How to Prompt Better Projects',
    url: 'https://soapbox.pub/blog/how-to-prompt-better-projects',
    author: 'Derek Ross',
  },
  {
    title: 'Deploying your Shakespeare project',
    url: 'https://soapbox.pub/blog/shakespeare-deploying-sharing-projects',
    author: 'M.K. Fain',
  },
  {
    title: 'Debugging in Shakespeare',
    url: 'https://soapbox.pub/blog/debugging-in-shakespeare',
    author: 'Derek Ross',
  },
];

export default function Community() {
  useSeoMeta({
    title: 'Community - Shakespeare',
    description: 'Join the Shakespeare community. Connect with builders, attend events, and get help with your projects.',
  });

  const { data: feedPosts, isLoading: feedLoading } = useShakespeareFeed(6);
  const { data: events, isLoading: eventsLoading } = useCommunityEvents(4);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Topbar */}
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10">
        <div className="container mx-auto px-4 py-3 max-w-5xl">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <ShakespeareLogo className="w-6 h-6" />
              <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Shakespeare
              </h1>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="space-y-12">
          {/* Hero Section */}
          <section className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Welcome to the Shakespeare Community
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect with builders, get help with your projects, and be part of the future of AI-powered web development.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
                <a href="https://app.flotilla.social/join?r=chat.shakespeare.diy&c=725J9PH4" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Join Shakespeare Chat
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#events">
                  <Calendar className="h-4 w-4 mr-2" />
                  Browse Events
                </a>
              </Button>
            </div>
          </section>

          {/* How to Get Involved - 3 Cards */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-center">How to Get Involved</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Join Community Online */}
              <Card className="overflow-hidden group hover:shadow-lg transition-shadow flex flex-col">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={STOCK_IMAGES.chat}
                    alt="Community chat"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardHeader className="flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Join Community Online</CardTitle>
                  <CardDescription>
                    Chat with other Shakespeare builders, get help with your projects, and share what you're creating.
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="outline" className="w-full">
                    <a href="https://app.flotilla.social/join?r=chat.shakespeare.diy&c=725J9PH4" target="_blank" rel="noopener noreferrer">
                      Join Shakespeare Chat
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Connect IRL */}
              <Card className="overflow-hidden group hover:shadow-lg transition-shadow flex flex-col">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={STOCK_IMAGES.events}
                    alt="Community events"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardHeader className="flex-1">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-2">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <CardTitle>Connect IRL</CardTitle>
                  <CardDescription>
                    Attend conferences, workshops, and meetups. Learn from experts and network with fellow builders.
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="outline" className="w-full">
                    <a href="#events">
                      View Events
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Become an Ambassador */}
              <Card className="overflow-hidden group hover:shadow-lg transition-shadow flex flex-col">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={STOCK_IMAGES.ambassador}
                    alt="Ambassador program"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    style={{ objectPosition: '50% 60%' }}
                  />
                </div>
                <CardHeader className="flex-1">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-2">
                    <Award className="h-5 w-5 text-yellow-600" />
                  </div>
                  <CardTitle>Become an Ambassador</CardTitle>
                  <CardDescription>
                    Host workshops in your city, teach others to build with Shakespeare, and earn recognition.
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="outline" className="w-full">
                    <a href="#ambassador">
                      Learn More
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* #ShakespeareDIY Feed */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                  #ShakespeareDIY Feed
                </h2>
                <p className="text-muted-foreground">See what the community is building</p>
              </div>
              <Badge variant="outline" className="w-fit">Live from Nostr</Badge>
            </div>

            {feedLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-16 w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : feedPosts && feedPosts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-fr">
                {feedPosts.map((post) => (
                  <FeedPost key={post.id} event={post} />
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No posts yet. Be the first to share with #ShakespeareDIY!
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Events Section */}
          <section id="events" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-accent" />
                  Upcoming Events
                </h2>
                <p className="text-muted-foreground">Conferences, workshops, and meetups</p>
              </div>
            </div>

            {eventsLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <Skeleton className="h-32 w-full rounded-lg mb-4" />
                      <Skeleton className="h-6 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : events && events.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    No upcoming events. Check back soon!
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Ambassador Program */}
          <section id="ambassador" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">Shakespeare Ambassador Program</CardTitle>
                  <CardDescription>
                    Become a community leader by hosting workshops in your city. Teach others how to build with Shakespeare
                    and help grow the community.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Host local workshops and meetups
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Get exclusive access to new features
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Earn free credits for teaching
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Be recognized in the community
                    </li>
                  </ul>
                  <Button asChild className="w-full">
                    <a href="https://app.flotilla.social/join?r=chat.shakespeare.diy&c=725J9PH4" target="_blank" rel="noopener noreferrer">
                      Apply to Become an Ambassador
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <div className="aspect-video overflow-hidden">
                  <img
                    src={STOCK_IMAGES.workshop}
                    alt="Workshop"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: '50% 10%' }}
                  />
                </div>
                <CardHeader>
                  <CardTitle>Host a Workshop</CardTitle>
                  <CardDescription>
                    Already know Shakespeare well? Host a workshop in your area and teach others how to build amazing
                    websites with AI.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <a href="https://soapbox.pub/blog/shakespeare-workshop-guide" target="_blank" rel="noopener noreferrer">
                      View Workshop Guide
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Chat Channels */}
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Hash className="h-6 w-6 text-primary" />
                Chat Channels
              </h2>
              <p className="text-muted-foreground">Explore the different channels in Shakespeare Chat</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Megaphone className="h-4 w-4 text-blue-500" />
                    </div>
                    <CardTitle className="text-base">#announcements</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Official updates about Shakespeare features, releases, and important news from the team.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-purple-500" />
                    </div>
                    <CardTitle className="text-base">#feedback</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Share your ideas, suggestions, and feedback to help improve Shakespeare.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <GitBranch className="h-4 w-4 text-green-500" />
                    </div>
                    <CardTitle className="text-base">#git</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Follow along with the latest commits and development activity on Shakespeare.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                    </div>
                    <CardTitle className="text-base">#prompts</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Share and discover effective prompts for building better projects with AI.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                      <Image className="h-4 w-4 text-pink-500" />
                    </div>
                    <CardTitle className="text-base">#showcase</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Show off your Shakespeare creations and get inspired by what others have built.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <LifeBuoy className="h-4 w-4 text-red-500" />
                    </div>
                    <CardTitle className="text-base">#support</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Get help from the community when you're stuck or have questions about using Shakespeare.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="text-center">
              <Button asChild>
                <a href="https://app.flotilla.social/join?r=chat.shakespeare.diy&c=725J9PH4" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Join Shakespeare Chat
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
          </section>

          {/* Resources Section */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-600" />
              Resources
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Blog Posts */}
              <Card>
                <CardHeader>
                  <CardTitle>Featured Guides</CardTitle>
                  <CardDescription>Learn tips and tricks from the community</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {BLOG_POSTS.map((post, i) => (
                    <a
                      key={i}
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
                    >
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">
                          {post.title}
                        </p>
                        <p className="text-sm text-muted-foreground">by {post.author}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </a>
                  ))}
                  <Button asChild variant="ghost" className="w-full mt-2">
                    <a
                      href="https://soapbox.pub/shakespeare-resources/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View All Resources
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* FAQs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Frequently Asked Questions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {FAQS.map((faq, i) => (
                      <AccordionItem key={i} value={`faq-${i}`}>
                        <AccordionTrigger className="text-left text-sm px-3">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-sm px-3">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  <Button asChild variant="ghost" className="w-full mt-4">
                    <a
                      href="https://soapbox.pub/shakespeare-resources/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View All FAQs
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Final CTA */}
          <section className="text-center space-y-4 py-8">
            <h2 className="text-2xl font-bold">Ready to Join?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Join Shakespeare Chat to connect with the community, get help with your projects, and be part of the
              conversation.
            </p>
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
              <a href="https://app.flotilla.social/join?r=chat.shakespeare.diy&c=725J9PH4" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />
                Join Shakespeare Chat
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

// Feed Post Component
function FeedPost({ event }: { event: NostrEvent }) {
  const { data: author } = useAuthor(event.pubkey);
  const displayName = author?.metadata?.name || genUserName(event.pubkey);
  const picture = author?.metadata?.picture;
  const timeAgo = getTimeAgo(event.created_at);
  const nevent = nip19.neventEncode({ id: event.id, author: event.pubkey });
  const njumpUrl = `https://njump.me/${nevent}`;

  return (
    <a href={njumpUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="pt-4 h-full">
          <div className="flex items-start gap-3 h-full">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={picture} alt={displayName} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{displayName}</span>
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>
              <div className="text-sm">
                <NoteContent event={event} className="line-clamp-4" disableLinks hideEmbeds />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

// Helper to check if a string is a URL
function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Event Card Component
function EventCard({ event }: { event: NostrEvent }) {
  const eventData = extractCalendarEventData(event);
  const formattedDate = formatEventDate(eventData.start, eventData.kind, eventData.startTzid);
  const isVirtual = eventData.location && isUrl(eventData.location);

  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      {eventData.image && (
        <div className="aspect-video overflow-hidden">
          <img
            src={eventData.image}
            alt={eventData.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{eventData.title}</CardTitle>
            {eventData.summary && (
              <CardDescription className="mt-1">{eventData.summary}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formattedDate}</span>
        </div>
        {eventData.location && (
          isVirtual ? (
            <a
              href={eventData.location}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Video className="h-4 w-4" />
              <span>Virtual</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{eventData.location}</span>
            </div>
          )
        )}
        {eventData.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {eventData.hashtags.slice(0, 3).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function
function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}
