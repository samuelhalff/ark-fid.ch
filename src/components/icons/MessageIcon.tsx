// Minimalist message/chat icon - represents all contact methods
export const MessageIcon = ({
  className = "",
  size = 20,
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
    {/* Rounded chat bubble */}
    <path
      d="M12 3C7.03 3 3 6.58 3 11C3 13.39 4.23 15.51 6.17 16.88L5 21L9.5 19.38C10.29 19.61 11.13 19.73 12 19.73C16.97 19.73 21 16.15 21 11.36C21 6.58 16.97 3 12 3Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Three dots inside bubble - optional */}
    <circle cx="8" cy="11" r="1" fill="currentColor" />
    <circle cx="12" cy="11" r="1" fill="currentColor" />
    <circle cx="16" cy="11" r="1" fill="currentColor" />
  </svg>
);
