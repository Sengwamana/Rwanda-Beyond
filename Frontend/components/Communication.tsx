import React, { useState } from 'react';
import { MessageSquare, Phone, Bell, Check, Trash2, Plus, Wifi, Send, CheckCircle, X } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface Alert {
  id: number;
  message: string;
  time: string;
  date: string;
  type: 'critical' | 'warning' | 'info';
}

interface Contact {
  id: string;
  name: string;
  number: string;
  role: string;
}

interface CommunicationProps {
    language?: Language;
}

export const Communication: React.FC<CommunicationProps> = ({ language = 'en' }) => {
  const t = translations[language].comm;
  const [activeTab, setActiveTab] = useState<'alerts' | 'compose'>('alerts');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', number: '', role: 'Neighbor' });

  const [contacts, setContacts] = useState<Contact[]>([
    { id: '1', name: 'Jean Claude', number: '+250 788 123 456', role: 'Head Farmer' },
    { id: '2', name: 'Marie Claire', number: '+250 788 654 321', role: 'Sector Agronomist' }
  ]);
  
  const [alerts] = useState<Alert[]>([
    { id: 1, message: 'CRITICAL: Soil moisture in Block B dropped below 28%.', time: '10:00 AM', date: 'Today', type: 'critical' },
    { id: 2, message: 'Warning: 40% chance of rain detected. Irrigation paused.', time: '08:30 AM', date: 'Today', type: 'warning' },
    { id: 3, message: 'Daily Report: NPK levels stable in Sector A.', time: '06:00 AM', date: 'Today', type: 'info' },
    { id: 4, message: 'System: Pump A maintenance scheduled for tomorrow.', time: '04:15 PM', date: 'Yesterday', type: 'info' },
    { id: 5, message: 'Alert: Fall Armyworm detected in Image #0043.', time: '02:00 PM', date: 'Yesterday', type: 'critical' },
  ]);

  const handleSend = () => {
      if (!message.trim()) return;
      setIsSending(true);
      setTimeout(() => {
          setSentMessages(prev => [{
              id: Date.now(),
              text: message,
              date: 'Just Now'
          }, ...prev]);
          setMessage('');
          setIsSending(false);
      }, 1500);
  };

  const handleAddContact = () => {
      if (!newContact.name || !newContact.number) return;
      setContacts(prev => [...prev, {
          id: Date.now().toString(),
          name: newContact.name,
          number: newContact.number,
          role: newContact.role
      }]);
      setNewContact({ name: '', number: '', role: 'Neighbor' });
      setIsAddingContact(false);
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
        
       {/* Add Contact Modal */}
       {isAddingContact && (
           <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-fade-in">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-lg font-bold text-slate-900">Add Contact</h3>
                       <button onClick={() => setIsAddingContact(false)}><X className="text-slate-400" /></button>
                   </div>
                   <div className="space-y-4">
                       <input 
                            type="text" placeholder="Name" 
                            value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-[#0F5132]/20"
                       />
                       <input 
                            type="tel" placeholder="Phone Number" 
                            value={newContact.number} onChange={e => setNewContact({...newContact, number: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-[#0F5132]/20"
                       />
                       <select 
                            value={newContact.role} onChange={e => setNewContact({...newContact, role: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-[#0F5132]/20"
                       >
                           <option>Neighbor</option>
                           <option>Family</option>
                           <option>Worker</option>
                           <option>Agronomist</option>
                       </select>
                       <button onClick={handleAddContact} className="w-full bg-[#0F5132] text-white py-3 rounded-xl font-bold hover:bg-[#0a3622] transition-colors">
                           Save Contact
                       </button>
                   </div>
               </div>
           </div>
       )}

       <div className="flex flex-col md:flex-row justify-between items-end md:items-center">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h2>
                <p className="text-slate-500 mt-1">{t.subtitle}</p>
            </div>
            <div className="flex items-center gap-3 bg-white border border-slate-100 px-5 py-2.5 rounded-full mt-4 md:mt-0 shadow-sm">
                <div className="relative">
                    <Wifi size={18} className="text-[#0F5132]" />
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                </div>
                <span className="text-sm font-bold text-slate-900">Gateway Online</span>
            </div>
        </div>

        <div className="flex gap-4 border-b border-slate-200 pb-1">
            <button 
                onClick={() => setActiveTab('alerts')}
                className={`pb-4 px-2 font-bold text-sm transition-colors ${activeTab === 'alerts' ? 'text-[#0F5132] border-b-2 border-[#0F5132]' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Alerts & History
            </button>
            <button 
                onClick={() => setActiveTab('compose')}
                className={`pb-4 px-2 font-bold text-sm transition-colors ${activeTab === 'compose' ? 'text-[#0F5132] border-b-2 border-[#0F5132]' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Compose & Sent
            </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
            
            {/* LEFT: Config or Compose */}
            {activeTab === 'alerts' ? (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
                                <Phone size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">{t.config}</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t.receivers}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsAddingContact(true)}
                            className="w-10 h-10 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors flex items-center justify-center shadow-lg"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                        {contacts.map(contact => (
                            <div key={contact.id} className="flex items-center justify-between p-5 bg-[#FAFAF9] rounded-[1.5rem] group hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-slate-400 font-bold border border-slate-100 text-lg">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-base">{contact.name}</p>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">{contact.role}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-xs text-slate-600 font-bold mb-2">{contact.number}</p>
                                    <div className="flex gap-2 justify-end">
                                        <span className="text-[10px] bg-emerald-100 text-[#0F5132] px-2.5 py-1 rounded-full font-bold">SMS</span>
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-bold">USSD</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                            <Send size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Broadcast Message</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Send to all contacts</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <textarea 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your message here..."
                            rows={6}
                            className="w-full bg-[#FAFAF9] border border-slate-200 rounded-2xl p-5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F5132]/20 focus:border-[#0F5132] resize-none"
                        ></textarea>
                        <div className="flex justify-end">
                            <button 
                                onClick={handleSend}
                                disabled={isSending || !message.trim()}
                                className="flex items-center gap-2 px-6 py-3 bg-[#0F5132] text-white rounded-full font-bold hover:bg-[#0a3622] transition-colors shadow-lg disabled:opacity-50"
                            >
                                {isSending ? 'Sending...' : <><Send size={16} /> Send Broadcast</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RIGHT: Lists */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm shadow-slate-200 border border-slate-100">
                <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
                        {activeTab === 'alerts' ? <Bell size={24} /> : <MessageSquare size={24} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">{activeTab === 'alerts' ? t.history : 'Sent History'}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            {activeTab === 'alerts' ? 'Recent System Notifications' : 'Outbound Messages'}
                        </p>
                    </div>
                </div>

                <div className="relative border-l-2 border-slate-100 ml-4 space-y-10 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                    {activeTab === 'alerts' ? alerts.map((alert) => (
                        <div key={alert.id} className="relative pl-8 group">
                            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ring-2 ring-transparent group-hover:ring-slate-100 transition-all ${
                                alert.type === 'critical' ? 'bg-red-500' : 
                                alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                            }`}></div>
                            
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    alert.type === 'critical' ? 'text-red-600 bg-red-50' : 
                                    alert.type === 'warning' ? 'text-amber-600 bg-amber-50' : 'text-blue-600 bg-blue-50'
                                }`}>
                                    {alert.type}
                                </span>
                                <span className="text-xs text-slate-400 font-bold">{alert.time}</span>
                            </div>
                            <p className="text-sm text-slate-700 font-medium leading-relaxed group-hover:text-slate-900 transition-colors">
                                {alert.message}
                            </p>
                        </div>
                    )) : sentMessages.length > 0 ? sentMessages.map((msg) => (
                        <div key={msg.id} className="relative pl-8 group animate-fade-in">
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm bg-slate-300"></div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">SMS</span>
                                <span className="text-xs text-slate-400 font-bold">{msg.date}</span>
                            </div>
                            <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                {msg.text}
                            </p>
                            <div className="flex items-center gap-1 mt-2 text-xs font-bold text-emerald-600">
                                <CheckCircle size={12} /> Delivered
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-slate-400 pl-8">No messages sent yet.</p>
                    )}
                </div>
            </div>

        </div>
    </div>
  );
};