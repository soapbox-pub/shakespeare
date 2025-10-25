export interface ShakespeareLogoProps {
  className?: string;
}

export function ShakespeareLogo({ className }: ShakespeareLogoProps) {
  return (
    <img
      src="/shakespeare.svg"
      alt="Shakespeare"
      className={className}
    />
  );
}