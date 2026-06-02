import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function EventsAdd() {
  const [showEventForm, setShowEventForm] = useState(true);
  const [showSpeakerForm, setShowSpeakerForm] = useState(true);

  // State for Events list
  const [events, setEvents] = useState([
    {
      id: 1,
      name: "RC Event-Logistics AB",
      type: "Seminar",
      startTime: "14:00",
      endTime: "17:00",
      attending: "40",
      date: "2026-01-15",
      mapUrl: "http://www.com",
      amount: "0:0",
      venue: "WebExcels-Sialkot",
      createDate: "13-01-2026",
      speakers: [
        {
          name: "Muhammad Shahbaz",
          startTime: "16:00",
          endTime: "16:30",
        }
      ]
    }
  ]);

  // State for Add Event Form
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventAttending, setEventAttending] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventMapUrl, setEventMapUrl] = useState("");
  const [eventAmount, setEventAmount] = useState("");
  const [eventVenue, setEventVenue] = useState("");

  // State for Add Speaker Form
  const [speakerName, setSpeakerName] = useState("");
  const [speakerEventId, setSpeakerEventId] = useState("");
  const [speakerTopic, setSpeakerTopic] = useState("");
  const [speakerStartTime, setSpeakerStartTime] = useState("");
  const [speakerEndTime, setSpeakerEndTime] = useState("");
  const [speakerDetail, setSpeakerDetail] = useState("");

  const handleAddEvent = () => {
    if (!eventName) return;
    
    const newEvent = {
      id: events.length + 1,
      name: eventName,
      type: eventType,
      startTime: eventStartTime,
      endTime: eventEndTime,
      attending: eventAttending,
      date: eventDate,
      mapUrl: eventMapUrl,
      amount: eventAmount,
      venue: eventVenue,
      createDate: format(new Date(), "dd-MM-yyyy"),
      speakers: []
    };

    setEvents([...events, newEvent]);
    
    // Clear form
    setEventName("");
    setEventType("");
    setEventStartTime("");
    setEventEndTime("");
    setEventAttending("");
    setEventDate("");
    setEventMapUrl("");
    setEventAmount("");
    setEventVenue("");
  };

  const handleAddSpeaker = () => {
    if (!speakerName || !speakerEventId) return;

    setEvents(events.map(ev => {
      if (ev.id.toString() === speakerEventId) {
        return {
          ...ev,
          speakers: [
            ...ev.speakers,
            {
              name: speakerName,
              startTime: speakerStartTime,
              endTime: speakerEndTime
            }
          ]
        };
      }
      return ev;
    }));

    // Clear form
    setSpeakerName("");
    setSpeakerEventId("");
    setSpeakerTopic("");
    setSpeakerStartTime("");
    setSpeakerEndTime("");
    setSpeakerDetail("");
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-4 font-sans dark:bg-zinc-950">
      <div className="mb-6 flex items-center text-sm font-bold tracking-wide uppercase">
        <span className="text-gray-700 dark:text-zinc-400">CREATE EVENT</span>
        <span className="mx-2">/</span>
        <button 
          onClick={() => setShowEventForm(!showEventForm)}
          className={`transition-colors uppercase font-bold text-sm hover:underline ${showEventForm ? 'text-[#00a65a]' : 'text-gray-500 dark:text-slate-400'}`}
        >
          ADD EVENT
        </button>
        <span className="mx-2">/</span>
        <button 
          onClick={() => setShowSpeakerForm(!showSpeakerForm)}
          className={`transition-colors uppercase font-bold text-sm hover:underline ${showSpeakerForm ? 'text-[#00a65a]' : 'text-gray-500 dark:text-slate-400'}`}
        >
          ADD SPEAKER
        </button>
      </div>

      <div className="space-y-6">
        {/* Add Event Form */}
        {showEventForm && (
          <Card className="shadow-sm border-t border-t-gray-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event Name</label>
                <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Enter the event name" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event Type</label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Seminar">Seminar</SelectItem>
                    <SelectItem value="Webinar">Webinar</SelectItem>
                    <SelectItem value="Social Media">Social Media</SelectItem>
                    <SelectItem value="Hum Mashal-e-Rah(lahore)">Hum Mashal-e-Rah(lahore)</SelectItem>
                    <SelectItem value="Tanveer Gujranwala">Tanveer Gujranwala</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Start Time</label>
                <Input type="time" value={eventStartTime} onChange={e => setEventStartTime(e.target.value)} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">End Time</label>
                <Input type="time" value={eventEndTime} onChange={e => setEventEndTime(e.target.value)} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Attending</label>
                <Input type="number" value={eventAttending} onChange={e => setEventAttending(e.target.value)} placeholder="Number of attending" className="text-sm h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Date</label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Map</label>
                <Input value={eventMapUrl} onChange={e => setEventMapUrl(e.target.value)} placeholder="http://www.com" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event Amount</label>
                <Input value={eventAmount} onChange={e => setEventAmount(e.target.value)} placeholder="0:0" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Venu</label>
                <Input value={eventVenue} onChange={e => setEventVenue(e.target.value)} placeholder="add detail" className="text-sm h-9" />
              </div>
            </div>

            <Button onClick={handleAddEvent} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-sm font-semibold rounded">
              Submit
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Add Speaker Form */}
        {showSpeakerForm && (
        <Card className="shadow-sm border-t border-t-gray-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Speaker Name</label>
                <Input value={speakerName} onChange={e => setSpeakerName(e.target.value)} placeholder="Enter the speaker name" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event</label>
                <Select value={speakerEventId} onValueChange={setSpeakerEventId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select Event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map(ev => (
                      <SelectItem key={ev.id} value={ev.id.toString()}>{ev.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Speaker Topic</label>
                <Input value={speakerTopic} onChange={e => setSpeakerTopic(e.target.value)} className="text-sm h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Start Time</label>
                <Input type="time" value={speakerStartTime} onChange={e => setSpeakerStartTime(e.target.value)} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">End Time</label>
                <Input type="time" value={speakerEndTime} onChange={e => setSpeakerEndTime(e.target.value)} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Detail</label>
                <Input value={speakerDetail} onChange={e => setSpeakerDetail(e.target.value)} placeholder="add detail" className="text-sm h-9" />
              </div>
            </div>

            <Button onClick={handleAddSpeaker} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-sm font-semibold rounded">
              Submit
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Data Table */}
        <Card className="shadow-sm border-t border-t-gray-200 bg-white dark:bg-zinc-900">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="text-xs text-gray-700 bg-white border-b font-bold dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-4 whitespace-nowrap">#</th>
                  <th className="px-4 py-4 whitespace-nowrap">Name</th>
                  <th className="px-4 py-4 whitespace-nowrap">Type</th>
                  <th className="px-4 py-4 whitespace-nowrap">Start Time</th>
                  <th className="px-4 py-4 whitespace-nowrap">End Time</th>
                  <th className="px-4 py-4 whitespace-nowrap">Attending</th>
                  <th className="px-4 py-4 whitespace-nowrap w-[350px]">Speaker</th>
                  <th className="px-4 py-4 whitespace-nowrap">Venu</th>
                  <th className="px-4 py-4 whitespace-nowrap">Map</th>
                  <th className="px-4 py-4 whitespace-nowrap">Event Date</th>
                  <th className="px-4 py-4 whitespace-nowrap">Create Date</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, idx) => (
                  <tr key={ev.id} className="border-b last:border-b-0 transition-colors">
                    <td className="px-4 py-4 text-[#d35400] font-medium align-top">{idx + 1}</td>
                    <td className="px-4 py-4 text-gray-600 font-medium align-top dark:text-zinc-300">{ev.name}</td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.type}</td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">
                      {ev.startTime}
                    </td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">
                      {ev.endTime}
                    </td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.attending}</td>
                    <td className="px-4 py-4 align-top">
                      {ev.speakers && ev.speakers.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-zinc-800">
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400">Name</th>
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400">Start</th>
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400">End</th>
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ev.speakers.map((sp, sIdx) => {
                              // Simple calculation for display if both are valid HH:mm
                              let total = "0:00";
                              if (sp.startTime && sp.endTime) {
                                const start = new Date(`1970-01-01T${sp.startTime}:00`);
                                const end = new Date(`1970-01-01T${sp.endTime}:00`);
                                const diffMs = end.getTime() - start.getTime();
                                if (diffMs > 0) {
                                  const hours = Math.floor(diffMs / 3600000);
                                  const minutes = Math.floor((diffMs % 3600000) / 60000);
                                  total = `${hours}:${minutes.toString().padStart(2, '0')}`;
                                }
                              }
                              return (
                                <tr key={sIdx}>
                                  <td className="pt-2 text-gray-600 dark:text-zinc-300">{sp.name}</td>
                                  <td className="pt-2 text-gray-600 dark:text-zinc-300">{sp.startTime}</td>
                                  <td className="pt-2 text-gray-600 dark:text-zinc-300">{sp.endTime}</td>
                                  <td className="pt-2 text-gray-600 dark:text-zinc-300">{total}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.venue}</td>
                    <td className="px-4 py-4 text-[#00a65a] align-top dark:text-zinc-400">
                      {ev.mapUrl ? (
                        <a href={ev.mapUrl} target="_blank" rel="noreferrer" title="View Map">
                          <div className="w-8 h-8 rounded-full border border-[#00a65a] flex items-center justify-center hover:bg-[#00a65a] hover:text-white transition-colors cursor-pointer dark:border-zinc-800">
                            <MapPin className="w-4 h-4" />
                          </div>
                        </a>
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 dark:border-zinc-800">
                          <MapPin className="w-4 h-4" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.date}</td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.createDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
