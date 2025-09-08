import { useEffect, useRef, useCallback } from 'react';

export type AnnouncementPriority = 'polite' | 'assertive';

interface Announcement {
  message: string;
  priority: AnnouncementPriority;
  timestamp: number;
}

export function useAnnouncer() {
  const queueRef = useRef<Announcement[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    // Create announcer elements if they don't exist
    let politeAnnouncer = document.getElementById('announcer-polite');
    let assertiveAnnouncer = document.getElementById('announcer-assertive');

    if (!politeAnnouncer) {
      politeAnnouncer = document.createElement('div');
      politeAnnouncer.id = 'announcer-polite';
      politeAnnouncer.setAttribute('role', 'status');
      politeAnnouncer.setAttribute('aria-live', 'polite');
      politeAnnouncer.setAttribute('aria-atomic', 'true');
      politeAnnouncer.className = 'sr-only';
      document.body.appendChild(politeAnnouncer);
    }

    if (!assertiveAnnouncer) {
      assertiveAnnouncer = document.createElement('div');
      assertiveAnnouncer.id = 'announcer-assertive';
      assertiveAnnouncer.setAttribute('role', 'alert');
      assertiveAnnouncer.setAttribute('aria-live', 'assertive');
      assertiveAnnouncer.setAttribute('aria-atomic', 'true');
      assertiveAnnouncer.className = 'sr-only';
      document.body.appendChild(assertiveAnnouncer);
    }

    return () => {
      // Cleanup is handled by the app, not individual components
    };
  }, []);

  const processQueue = useCallback(() => {
    if (processingRef.current || queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;
    const announcement = queueRef.current.shift();

    if (announcement) {
      const announcer = document.getElementById(
        announcement.priority === 'assertive' ? 'announcer-assertive' : 'announcer-polite'
      );

      if (announcer) {
        // Clear the announcer first to ensure the screen reader picks up the new message
        announcer.textContent = '';
        
        setTimeout(() => {
          announcer.textContent = announcement.message;
          
          // Clear the message after a delay to prepare for the next announcement
          setTimeout(() => {
            announcer.textContent = '';
            processingRef.current = false;
            processQueue();
          }, 1000);
        }, 100);
      }
    }
  }, []);

  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    queueRef.current.push({
      message,
      priority,
      timestamp: Date.now()
    });

    processQueue();
  }, [processQueue]);

  const announceAction = useCallback((action: string) => {
    announce(action, 'assertive');
  }, [announce]);

  const announceStatus = useCallback((status: string) => {
    announce(status, 'polite');
  }, [announce]);

  return {
    announce,
    announceAction,
    announceStatus
  };
}