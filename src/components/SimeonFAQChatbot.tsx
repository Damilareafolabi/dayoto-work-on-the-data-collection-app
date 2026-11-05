import React, { useState } from 'react';
import {
  MessageSquare,
  X,
  Send,
  HelpCircle,
  Shield,
  Smartphone,
  Wifi,
  Database,
  Lock,
  ChevronRight,
  Info,
} from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  category: string;
  answer: string;
}

const FAQ_DATABASE: FAQItem[] = [
  {
    id: 'install_pwa',
    category: 'Installation & PWA',
    question: 'How do interviewers install the PWA without an app store?',
    answer:
      'Interviewers scan the QR code displayed on the CMRG website or visit the site URL in Chrome (Android) or Safari (iOS). On Android Chrome, tap the menu and choose "Install app" or "Add to Home screen". On iOS Safari, tap the Share icon and select "Add to Home Screen". The app then launches standalone in full-screen with offline capabilities.',
  },
  {
    id: 'offline_sync',
    category: 'Offline Syncing',
    question: 'How does offline survey collection and synchronization work?',
    answer:
      'When offline, interview drafts, form schemas, and media files are securely stored in the browser’s IndexedDB vault. The app assigns a unique UUID instanceId to each interview. When internet connectivity is restored, queued interviews sync to the server. The server verifies idempotency using the instanceId so network retries will never create duplicate records.',
  },
  {
    id: 'question_types',
    category: 'Questionnaires',
    question: 'Which question types and validations are supported?',
    answer:
      'CMRG supports text, long text, numeric with bounds validation, ISO date (YYYY-MM-DD), yes/no boolean, single choice, multiple choice, and repeatable groups (such as household rosters). Every question is validated server-side against the form schema before acceptance.',
  },
  {
    id: 'enumerator_management',
    category: 'Field Teams',
    question: 'How do administrators provision and deactivate enumerator access?',
    answer:
      'Administrators issue dedicated access codes and device IDs via the Enumerators tab. Self-registration is disabled for data integrity. If an enumerator leaves the study or loses a tablet, the administrator can deactivate their account with one click; the server immediately rejects all subsequent submission attempts with HTTP 403 Forbidden.',
  },
  {
    id: 'situation_privacy',
    category: 'Situation GIS & Privacy',
    question: 'How does the Situation Map protect respondent confidentiality?',
    answer:
      'The Leaflet Situation Map queries an authorized server endpoint (/api/situation/locations) that strictly strips respondent names, answers, access codes, and private media. The map displays only operational metadata (questionnaire title, surveyor ID, status, and GPS coordinates). Records without GPS are safely quarantined in the unmapped list without fake coordinates.',
  },
  {
    id: 'test_credentials',
    category: 'Access & Demo',
    question: 'What credentials can I use to test the application?',
    answer:
      'You can sign in with test field officer accounts such as Kwame Asante (enum_01), Amina Bello (enum_02), or access the Administrator dashboard directly via /app. Deactivated account enum_deactivated can be used to test access control enforcement.',
  },
  {
    id: 'production_readiness',
    category: 'Deployment & Status',
    question: 'Is this system ready for live respondent data?',
    answer:
      'No. In accordance with CMRG operational standards, real respondent data must not be collected until CMRG verifies live production HTTPS hosting, persistent PostgreSQL database hosting, private durable S3/GCS media buckets, access control audits, and automated backup and restore procedures. Currently, only synthetic test data should be used.',
  },
];

export const SimeonFAQChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeItem, setActiveItem] = useState<FAQItem | null>(null);
  const [conversation, setConversation] = useState<
    Array<{ sender: 'user' | 'bot'; text: string; time: string }>
  >([
    {
      sender: 'bot',
      text: 'Welcome to CMRG Data Collect. I am your local field assistant built by SimeonJrStudios. How can I assist you with offline collection, questionnaire authoring, or situation monitoring today?',
      time: 'Just now',
    },
  ]);

  const handleSelectQuestion = (item: FAQItem) => {
    setActiveItem(item);
    setConversation((prev) => [
      ...prev,
      { sender: 'user', text: item.question, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      { sender: 'bot', text: item.answer, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userText = query.trim();
    setQuery('');

    // Local keyword matching across FAQ database
    const lower = userText.toLowerCase();
    const match = FAQ_DATABASE.find(
      (item) =>
        item.question.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower) ||
        item.answer.toLowerCase().includes(lower)
    );

    const botResponse = match
      ? match.answer
      : 'I am a fixed local guidance engine (powered by SimeonJrStudios). For this question, please select one of the verified field guide topics below, or contact your CMRG project administrator.';

    setConversation((prev) => [
      ...prev,
      { sender: 'user', text: userText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      { sender: 'bot', text: botResponse, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-2xl flex items-center gap-2.5 transition-transform hover:scale-105 group border-2 border-slate-900"
          aria-label="Open Field FAQ Assistant"
        >
          <MessageSquare className="w-6 h-6" />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-black tracking-wider uppercase">Field Help Guide</span>
            <span className="text-[10px] text-red-200">SimeonJrStudios Local FAQ</span>
          </div>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 w-[95vw] sm:w-[420px] max-h-[85vh] h-[600px] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white font-sans animate-fadeIn">
          {/* Header */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    CMRG Field Assistant
                  </h3>
                  <span className="text-[9px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded border border-red-500/30">
                    Local FAQ
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>Engine by SimeonJrStudios</span>
                  <span>&bull;</span>
                  <span className="text-emerald-400">Offline Ready</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              aria-label="Close Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Honest Attribution Disclaimer Banner */}
          <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800 text-[10px] text-slate-400 flex items-start gap-2 shrink-0">
            <Info className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <span>
              <strong>Attribution Notice:</strong> Built by SimeonJrStudios as a deterministic local guidance engine. This is an offline field guide, not a live AI service or human support desk.
            </span>
          </div>

          {/* Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {conversation.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-red-600 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">{msg.time}</span>
              </div>
            ))}

            {/* Quick Answer Recommendations */}
            <div className="pt-2 space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block px-1">
                Frequently Asked Fieldwork Questions
              </span>
              <div className="space-y-1.5">
                {FAQ_DATABASE.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectQuestion(item)}
                    className="w-full text-left p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition flex items-center justify-between group"
                  >
                    <span className="truncate pr-2">{item.question}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Query Input */}
          <form
            onSubmit={handleSendCustom}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a field guide question..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 font-sans"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="p-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl transition"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
