import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useEventResponses(eventId) {
  const [event, setEvent] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (!eventDoc.exists()) {
        console.error('イベントが見つかりません');
        setEvent(null);
        setLoading(false);
        return;
      }

      const eventData = { id: eventDoc.id, ...eventDoc.data() };
      setEvent(eventData);

      const responsesRef = collection(db, 'events', eventId, 'responses');
      const snapshot = await getDocs(responsesRef);

      const responsesData = await Promise.all(
        snapshot.docs.map(async (responseDoc) => {
          const responseData = { id: responseDoc.id, ...responseDoc.data() };

          const timeSlotsRef = collection(db, 'events', eventId, 'responses', responseDoc.id, 'timeSlots');
          const timeSlotsSnapshot = await getDocs(timeSlotsRef);

          responseData.timeSlots = timeSlotsSnapshot.docs.map(timeSlotDoc => ({
            id: timeSlotDoc.id,
            ...timeSlotDoc.data()
          })) || [];

          if (responseData.timeSlots.length === 0 && responseData.times) {
            responseData.timeSlots = responseData.times || [];
          }

          return responseData;
        })
      );

      responsesData.sort((a, b) => {
        const aTime = a.submittedAt?.toDate?.() || new Date(0);
        const bTime = b.submittedAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      setResponses(responsesData);
    } catch (error) {
      console.error('イベント・回答取得エラー:', error);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  return { event, responses, loading, setEvent, setResponses, reload: load };
}
