export function CookieIcon({
  className = "",
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M21 12a9 9 0 1 1-9-9 3 3 0 0 0 3 3 3 3 0 0 1 3 3 3 3 0 0 0 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="14.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="15" cy="14.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}
