import { Mail, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { GithubIcon } from '@/components/brand-icons';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { Separator } from '@/components/ui/separator';

import { DetailCard } from './DetailCard';
import { NAMESPACE } from './SettingsButton.i18n';

type Channel = { type: 'telegram' | 'mail' | 'github'; href: string };
type Member = { name: string; avatar: string; channels: Channel[] };

const TEAM: Member[] = [
  {
    name: 'Johan',
    avatar: '/profiles/johan.jpeg',
    channels: [
      { type: 'telegram', href: 'https://t.me/jooooooohan' },
      { type: 'mail', href: 'mailto:johan@freifahren.org' },
      { type: 'github', href: 'https://github.com/johan-t' },
    ],
  },
  {
    name: 'Moritz',
    avatar: '/profiles/moritz.jpeg',
    channels: [
      { type: 'mail', href: 'mailto:moritz@freifahren.org' },
      { type: 'github', href: 'https://github.com/mclrc' },
    ],
  },
  {
    name: 'David',
    avatar: '/profiles/david.jpeg',
    channels: [
      { type: 'mail', href: 'mailto:david@freifahren.org' },
      { type: 'github', href: 'https://github.com/brandesdavid' },
    ],
  },
];

const CHANNEL_ICON = { telegram: Send, mail: Mail, github: GithubIcon } as const;
const CHANNEL_LABEL = { telegram: 'Telegram', mail: 'Email', github: 'GitHub' } as const;

type ContactCardProps = {
  onClose: () => void;
};

export function ContactCard({ onClose }: ContactCardProps) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <DetailCard title={t('contact')} closeLabel={t('close')} onClose={onClose}>
      <CardContent className="flex flex-col gap-1">
        {TEAM.map((member) => (
          <div key={member.name} className="flex items-center gap-3 py-1">
            <img
              src={member.avatar}
              alt=""
              className="bg-muted size-8 shrink-0 rounded-full object-cover"
            />
            <span className="text-sm font-medium">{member.name}</span>
            <div className="ml-auto flex items-center gap-1">
              {member.channels.map((channel) => {
                const Icon = CHANNEL_ICON[channel.type];
                return (
                  <Button
                    key={channel.type}
                    asChild
                    variant="ghost"
                    size="icon-lg"
                    aria-label={`${member.name} – ${CHANNEL_LABEL[channel.type]}`}
                  >
                    <a href={channel.href} target="_blank" rel="noopener noreferrer">
                      <Icon />
                    </a>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>

      <Separator className="my-1" />

      <CardContent className="flex flex-col gap-2">
        <SectionHeading className="text-muted-foreground">{t('aboutTitle')}</SectionHeading>
        <p className="text-muted-foreground text-sm leading-relaxed">{t('about1')}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">{t('about2')}</p>
      </CardContent>
    </DetailCard>
  );
}
