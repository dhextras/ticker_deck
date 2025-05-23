import { useEffect, useState } from "react";
import type { NotificationData } from "~/types";

interface NotificationPopupProps {
  notification: NotificationData | null;
  onClose: () => void;
}

export default function NotificationPopup({ notification, onClose }: NotificationPopupProps) {
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
      case 'success':
        return 'bg-green-600 border-green-400';
      case 'warning':
        return 'bg-yellow-600 border-yellow-400';
      case 'error':
        return 'bg-red-600 border-red-400';
      default:
        return 'bg-blue-600 border-blue-400';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isVisible ? 'animate-slide-up opacity-100' : 'opacity-0 translate-y-full'
    }`}>
      <div className={`
        max-w-md p-4 rounded-lg border-2 shadow-lg text-white
        ${getTypeStyles()}
      `}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className="font-bold text-lg mb-1">{notification.title}</h4>
            <p className="text-sm opacity-90">{notification.message}</p>
            <p className="text-xs opacity-70 mt-2">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 text-white hover:text-gray-300 transition-colors"
            aria-label="Close notification"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
