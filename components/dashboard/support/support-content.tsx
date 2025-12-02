import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import BrandingTitle from "@/components/branding/branding-title";

interface SupportCardProps {
  title: string;
  description: string;
  icon: string;
  link: string;
  badge?: {
    text: string;
    variant: "default" | "destructive" | "outline" | "secondary";
  };
}

const SupportCard = ({ title, description, icon, link, badge }: SupportCardProps) => (
  <Link href={link} target="_blank" rel="noopener noreferrer">
    <Card className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon name={icon} className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            {badge && (
              <Badge variant={badge.variant}>{badge.text}</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </Card>
  </Link>
);

export function SupportContent() {
  const whatsappNumber = "+971547857926";
  const whatsappLink = `https://wa.me/${whatsappNumber.replace(/\s+/g, '')}`;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Support & Resources</h1>
        <p className="text-muted-foreground">Get help, share feedback, and stay updated with <BrandingTitle fallback="Magic Teams" /></p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SupportCard
          title="Feedback"
          description="Share your thoughts, suggestions, and ideas to help improve Magic Teams"
          icon="message-square"
          link="https://magicteamsai.userjot.com/board/all?cursor=1&order=top&limit=10"
          badge={{ text: "New", variant: "secondary" }}
        />

        <SupportCard
          title="Product Roadmap"
          description="See what features and improvements are coming to Magic Teams"
          icon="map"
          link="https://magicteamsai.userjot.com/roadmap?cursor=1&limit=10"
        />

        <SupportCard
          title="Product Updates"
          description="Stay informed about the latest changes and improvements"
          icon="bell"
          link="https://magicteamsai.userjot.com/updates?cursor=1&limit=10"
        />

        <SupportCard
          title="WhatsApp Support"
          description="Get instant support from our team via WhatsApp"
          icon="message-circle"
          link={whatsappLink}
          badge={{ text: "24/7", variant: "default" }}
        />
      </div>

      <div className="mt-8 text-center">
        <p className="text-muted-foreground mb-4">
          Need immediate assistance? Our support team is available 24/7
        </p>
        <Button
          size="lg"
          className="gap-2"
          onClick={() => window.open(whatsappLink, '_blank')}
        >
          <Icon name="message-circle" className="h-5 w-5" />
          Contact Support on WhatsApp
        </Button>
      </div>
    </div>
  );
} 