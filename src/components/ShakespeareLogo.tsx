import shakespeareLogo from '/shakespeare.svg';

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