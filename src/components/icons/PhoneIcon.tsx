// Minimalist phone icon - custom SVG
export const PhoneIcon = ({
  className = "",
  size = 18,
}: {
  className?: string;
  size?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Modern phone icon - simple curved shape */}
    <path
      d="M5 4H9C9.55228 4 10 4.44772 10 5V9C10 9.55228 9.55228 10 9 10H6C6 13.866 9.13401 17 13 17V14C13 13.4477 13.4477 13 14 13H18C18.5523 13 19 13.4477 19 14V18C19 18.5523 18.5523 19 18 19H14C8.47715 19 4 14.5228 4 9V5C4 4.44772 4.44772 4 5 4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
