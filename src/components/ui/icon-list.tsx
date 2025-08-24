import React from "react";
import TranslatedText from "./translated-text";

interface ListItem {
  key: string;
  fallbackText: string;
}

interface IconListProps {
  items: ListItem[];
  namespace: string;
  icon?: React.ReactNode;
  className?: string;
}

const IconList: React.FC<IconListProps> = ({
  items,
  namespace,
  icon,
  className = "",
}) => {
  return (
    <div className={`grid gap-4 ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-3">
          {icon && <div className="mt-0.5 flex-shrink-0">{icon}</div>}
          <p className="text-muted-foreground">
            <TranslatedText
              ns={namespace}
              translationKey={item.key}
              fallbackText={item.fallbackText}
            />
          </p>
        </div>
      ))}
    </div>
  );
};

export default IconList;
