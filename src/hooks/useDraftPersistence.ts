import { useState, useEffect, useCallback } from 'react';

interface DraftData {
  ncfSuffix: string;
  invoiceDate: string;
  selectedClientId: string | null;
  totalInvoice: number;
  productAmounts: Record<string, number>;
  step1Complete: boolean;
  step2Complete: boolean;
  savedAt: number;
}

const DRAFT_KEY = 'invoice_draft';
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useDraftPersistence = () => {
  const [recoveredDraft, setRecoveredDraft] = useState<DraftData | null>(null);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);

  // Check for existing draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft: DraftData = JSON.parse(savedDraft);
        const now = Date.now();
        
        // Check if draft is not expired and has meaningful data
        if (
          now - draft.savedAt < DRAFT_EXPIRY_MS &&
          (draft.totalInvoice > 0 || draft.step1Complete || draft.step2Complete)
        ) {
          setRecoveredDraft(draft);
          setShowRecoveryPrompt(true);
        } else {
          // Clear expired draft
          localStorage.removeItem(DRAFT_KEY);
        }
      } catch (e) {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  // Save draft to localStorage
  const saveDraft = useCallback((data: Omit<DraftData, 'savedAt'>) => {
    const draftWithTime: DraftData = {
      ...data,
      savedAt: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftWithTime));
  }, []);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setRecoveredDraft(null);
    setShowRecoveryPrompt(false);
  }, []);

  // Dismiss recovery prompt without clearing draft data for restoration
  const dismissRecoveryPrompt = useCallback(() => {
    setShowRecoveryPrompt(false);
  }, []);

  // Accept recovery - returns the draft data and clears prompt
  const acceptRecovery = useCallback(() => {
    setShowRecoveryPrompt(false);
    return recoveredDraft;
  }, [recoveredDraft]);

  return {
    recoveredDraft,
    showRecoveryPrompt,
    saveDraft,
    clearDraft,
    dismissRecoveryPrompt,
    acceptRecovery,
  };
};
