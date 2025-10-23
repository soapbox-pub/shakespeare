import shakespeareLogo from '/shakespeare.svg?url';

export interface ShakespeareLogoProps {
  className?: string;
}

export function ShakespeareLogo({ className }: ShakespeareLogoProps) {
  return (
    <img
      src={shakespeareLogo}
      alt="Shakespeare"
      className={className}
    />
  );
}