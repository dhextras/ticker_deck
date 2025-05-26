import { useEffect, useState } from "react";
import type { NotificationData } from "~/types";

interface NotificationPopupProps {
  notification: NotificationData | null;
  onClose: () => void;
}

export default function NotificationPopup({
  notification,
  onClose,
}: NotificationPopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);

      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [notification]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  if (!notification) return null;

  const getTypeStyles = () => {
    switch (notification.type) {
      case "success":
        return "bg-green-600 border-green-400";
      case "warning":
        return "bg-yellow-600 border-yellow-400";
      case "error":
        return "bg-red-600 border-red-400";
      default:
        return "bg-blue-600 border-blue-400";
    }
  };

  return (
    <div
      className={`fixed right-4 top-4 z-50 transition-all duration-300 ${
        isVisible
          ? "animate-slide-up opacity-100"
          : "translate-y-full opacity-0"
      }`}
    >
      <div
        className={`max-w-md rounded-lg border-2 p-4 text-white shadow-lg ${getTypeStyles()} `}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="mb-1 text-lg font-bold">{notification.title}</h4>
            <p className="text-sm opacity-90">{notification.message}</p>
            <p className="mt-2 text-xs opacity-70">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 text-white transition-colors hover:text-gray-300"
            aria-label="Close notification"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
