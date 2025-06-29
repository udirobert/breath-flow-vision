import { useLensFeed, Publication } from "@/hooks/useLensFeed";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { MirrorButton } from "@/components/MirrorButton";
import { CollectButton } from "@/components/CollectButton";
import { CommentForm } from "@/components/CommentForm";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { CommentList } from "@/components/CommentList";

const PublicationCard = ({ pub }: { pub: Publication }) => {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCommentForm, setShowCommentForm] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!pub.contentURI) return;
      setLoading(true);
      try {
        const response = await fetch(
          pub.contentURI.replace("ipfs://", "https://ipfs.io/ipfs/")
        );
        const data = await response.json();
        setMetadata(data);
      } catch (error) {
        console.error("Failed to fetch publication metadata:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, [pub.contentURI]);

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{metadata?.name || "Untitled Publication"}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{metadata?.description || "No description available."}</p>
        {metadata?.image && (
          <img
            src={metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")}
            alt={metadata.name}
            className="mt-4 rounded-lg"
          />
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2">
        <div className="flex gap-2">
          <MirrorButton
            profileIdPointed={pub.profileIdPointed}
            pubIdPointed={pub.pubIdPointed}
          />
          <CollectButton
            profileIdPointed={pub.profileIdPointed}
            pubIdPointed={pub.pubIdPointed}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCommentForm(!showCommentForm)}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Comment
          </Button>
        </div>
        {showCommentForm && (
          <CommentForm
            profileIdPointed={pub.profileIdPointed}
            pubIdPointed={pub.pubIdPointed}
            onCommentPosted={() => setShowCommentForm(false)}
          />
        )}
        {showCommentForm && (
          <CommentList
            profileId={pub.profileIdPointed}
            pubId={pub.pubIdPointed}
          />
        )}
      </CardFooter>
    </Card>
  );
};

const CommunityFeedPage = () => {
  const { feed, loading } = useLensFeed();

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Community Feed</h1>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Community Feed</h1>
      {feed.length === 0 ? (
        <p>No publications found in your feed.</p>
      ) : (
        <div className="space-y-4">
          {feed.map((pub, index) => (
            <PublicationCard key={index} pub={pub} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityFeedPage;
