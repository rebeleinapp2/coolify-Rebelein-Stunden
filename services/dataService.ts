
import { useState, useEffect, useCallback } from 'react';
import { TimeEntry, UserSettings, DEFAULT_SETTINGS, DailyLog, LockedDay, UserAbsence, VacationRequest, DailyTarget } from '../types';
import { supabase } from './supabaseClient';

// --- Helper Functions ---

/**
 * Returns the correct target hours for a specific date based on the user's settings.
 * Previously handled history, now simplified to just current settings.
 */
export const getDailyTargetForDate = (dateStr: string, fallbackTargets: DailyTarget): number => {
    const dow = new Date(dateStr).getDay();
    return fallbackTargets[dow as keyof DailyTarget] || 0;
};

/**
 * Erstellt einen ISO-String (YYYY-MM-DD) basierend auf der LOKALEN Zeit des Geräts,
 * nicht UTC. Verhindert Datumsfehler spät nachts.
 */
export const getLocalISOString = (dateObj: Date = new Date()): string => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Hooks ---

export const useInstallers = () => {
    const [installers, setInstallers] = useState<UserSettings[]>([]);

    useEffect(() => {
        const fetchInstallers = async () => {
            const { data } = await supabase
                .from('user_settings')
                .select('*')
                .order('display_name');
            
            if (data) {
                setInstallers(data as UserSettings[]);
            }
        };
        fetchInstallers();
    }, []);

    return installers;
};

export const usePeerReviews = () => {
    const [reviews, setReviews] = useState<TimeEntry[]>([]);
    
    const fetchReviews = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Einträge, bei denen ICH als responsible eingetragen bin, aber noch NICHT bestätigt habe
        const { data, error } = await supabase
            .from('time_entries')
            .select('*')
            .eq('responsible_user_id', user.id)
            .is('confirmed_at', null)
            .order('date', { ascending: false });

        if (error) console.error("Error fetching reviews", error);
        else setReviews(data as TimeEntry[]);
    }, []);

    useEffect(() => {
        fetchReviews();
        // Realtime
        const channel = supabase
            .channel('realtime_reviews')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
                fetchReviews();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchReviews]);

    const processReview = async (entryId: string, action: 'confirm' | 'reject', reason?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (action === 'confirm') {
            await supabase.from('time_entries').update({
                confirmed_by: user.id,
                confirmed_at: new Date().toISOString()
            }).eq('id', entryId);
        } else {
            // Ablehnen: Verantwortlichkeit entfernen (zurück an Ersteller) und Notiz ergänzen
            const { data: currentEntry } = await supabase.from('time_entries').select('note').eq('id', entryId).single();
            const newNote = currentEntry?.note ? `${currentEntry.note} | Abgelehnt: ${reason}` : `Abgelehnt: ${reason}`;
            
            await supabase.from('time_entries').update({
                responsible_user_id: null, // Entferne mich als Verantwortlichen
                note: newNote
            }).eq('id', entryId);
        }
        await fetchReviews();
    };

    return { reviews, processReview, fetchReviews };
};

export const useTimeEntries = (customUserId?: string) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockedDays, setLockedDays] = useState<string[]>([]); // Array of date strings

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    
    // Get current user first to determine context
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || (!user && !customUserId)) {
        setLoading(false);
        return;
    }

    let query = supabase
      .from('time_entries')
      .select('*')
      .order('date', { ascending: false })
      .order('start_time', { ascending: true });
    
    if (customUserId) {
        query = query.eq('user_id', customUserId);
    } else if (user) {
        query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching entries:', error.message || JSON.stringify(error));
    } else if (data) {
      setEntries(data as TimeEntry[]);
    }

    let userToCheck = customUserId || user?.id;
    if (userToCheck) {
        const { data: locks } = await supabase.from('locked_days').select('date').eq('user_id', userToCheck);
        if (locks) setLockedDays(locks.map(l => l.date));
    }
    
    setLoading(false);
  }, [customUserId]);

  const addEntry = async (entry: Omit<TimeEntry, 'id' | 'created_at' | 'user_id'>) => {
    if (lockedDays.includes(entry.date)) {
        alert("Dieser Tag ist gesperrt und kann nicht bearbeitet werden.");
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = customUserId || user?.id;

    if (!targetUserId) {
        console.error("No user ID found for addEntry");
        return;
    }

    const { error } = await supabase.from('time_entries').insert([{
        ...entry,
        user_id: targetUserId
    }]);
    
    if (error) {
      console.error("Supabase Error:", error);
      alert("Fehler beim Speichern: " + (error.message || JSON.stringify(error)));
    } else {
      await fetchEntries();
    }
  };

  const updateEntry = async (id: string, updates: Partial<TimeEntry>) => {
    const entry = entries.find(e => e.id === id);
    if (entry && lockedDays.includes(entry.date)) {
         alert("Dieser Tag ist gesperrt.");
         return;
    }
    if (updates.date && lockedDays.includes(updates.date)) {
        alert("Ziel-Datum ist gesperrt.");
        return;
    }

    const { error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error("Update Error:", error);
      alert("Fehler beim Aktualisieren: " + (error.message || JSON.stringify(error)));
    } else {
      await fetchEntries();
    }
  };

  const deleteEntry = async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry && lockedDays.includes(entry.date)) {
         alert("Dieser Tag ist gesperrt.");
         return;
    }

    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) {
       console.error("Delete Error:", error.message || JSON.stringify(error));
       alert("Löschen fehlgeschlagen: " + (error.message || "Unbekannter Fehler"));
    } else {
       await fetchEntries();
    }
  }

  const markAsSubmitted = async (ids: string[]) => {
    if (ids.length === 0) return;

    const { error } = await supabase
      .from('time_entries')
      .update({ submitted: true })
      .in('id', ids);

    if (error) {
        console.error("Error marking as submitted:", error.message || JSON.stringify(error));
    } else {
        setEntries(current => 
            current.map(e => ids.includes(e.id) ? { ...e, submitted: true } : e)
        );
    }
  }

  const confirmEntry = async (entryId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('time_entries').update({
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString()
      }).eq('id', entryId);

      if (!error) await fetchEntries();
  };

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('realtime_entries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
        fetchEntries();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries]);

  return { entries, loading, addEntry, updateEntry, deleteEntry, markAsSubmitted, confirmEntry, lockedDays };
};

export const useDailyLogs = (customUserId?: string) => {
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDailyLogs = useCallback(async () => {
    setLoading(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || (!user && !customUserId)) {
        setLoading(false);
        return;
    }

    let query = supabase.from('daily_logs').select('*');
    
    if (customUserId) {
        query = query.eq('user_id', customUserId);
    } else if (user) {
        query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    
    if (error) {
      console.warn('Error fetching daily logs:', error.message || JSON.stringify(error));
    } else if (data) {
      const sanitized = data.map((item: any) => ({
        ...item,
        start_time: item.start_time || '',
        end_time: item.end_time || '',
        break_start: item.break_start || '',
        break_end: item.break_end || '',
        segments: item.segments || [] 
      }));
      setDailyLogs(sanitized as DailyLog[]);
    }
    setLoading(false);
  }, [customUserId]);

  const saveDailyLog = useCallback(async (log: DailyLog) => {
    let targetUserId = customUserId;
    if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
    }
    
    if (!targetUserId) return;

    const toDb = (val: string | undefined | null) => (!val || val === '') ? null : val;

    setDailyLogs(prev => {
      const existingIndex = prev.findIndex(l => l.date === log.date);
      if (existingIndex >= 0) {
        const current = prev[existingIndex];
        if (JSON.stringify(current) === JSON.stringify({ ...current, ...log })) {
            return prev;
        }
        const newLogs = [...prev];
        newLogs[existingIndex] = { ...newLogs[existingIndex], ...log };
        return newLogs;
      }
      return [...prev, { ...log, user_id: targetUserId }];
    });

    const { error } = await supabase
      .from('daily_logs')
      .upsert({
        user_id: targetUserId,
        date: log.date,
        start_time: toDb(log.start_time),
        end_time: toDb(log.end_time),
        break_start: toDb(log.break_start),
        break_end: toDb(log.break_end),
        segments: log.segments 
      }, { onConflict: 'user_id, date' });

    if (error) console.error("Error saving daily log:", error.message || error);
  }, [customUserId]);

  const getLogForDate = useCallback((date: string) => {
    return dailyLogs.find(l => l.date === date) || { 
        date, 
        start_time: '', 
        end_time: '', 
        break_start: '', 
        break_end: '',
        segments: []
    };
  }, [dailyLogs]);

  useEffect(() => {
    fetchDailyLogs();
    const channel = supabase
      .channel('realtime_daily_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs' }, () => {
        fetchDailyLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDailyLogs]);

  return { dailyLogs, saveDailyLog, getLogForDate, loading, fetchDailyLogs };
};

export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
          setLoading(false);
          return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSettings({
          user_id: data.user_id,
          display_name: data.display_name || DEFAULT_SETTINGS.display_name,
          role: data.role || DEFAULT_SETTINGS.role,
          target_hours: data.target_hours || DEFAULT_SETTINGS.target_hours,
          work_config: data.work_config || DEFAULT_SETTINGS.work_config,
          work_config_locked: data.work_config_locked || false,
          preferences: data.preferences || DEFAULT_SETTINGS.preferences,
          vacation_days_yearly: data.vacation_days_yearly || DEFAULT_SETTINGS.vacation_days_yearly,
          employment_start_date: data.employment_start_date || undefined,
          initial_overtime_balance: data.initial_overtime_balance || 0
        });
      } else if (error && error.code === 'PGRST116') {
        const { error: insertError } = await supabase.from('user_settings').insert({
          user_id: user.id,
          display_name: DEFAULT_SETTINGS.display_name,
          target_hours: DEFAULT_SETTINGS.target_hours,
          work_config: DEFAULT_SETTINGS.work_config,
          preferences: DEFAULT_SETTINGS.preferences
        });
        if (!insertError) setSettings(DEFAULT_SETTINGS);
      } else if (error) {
          console.error("Error fetching settings:", error.message || JSON.stringify(error));
      }
      setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    const channel = supabase
      .channel('realtime_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, () => {
        fetchSettings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSettings]);

  const updateSettings = async (newSettings: UserSettings) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Kein Benutzer angemeldet' } };

    if (settings.work_config_locked) {
        newSettings.target_hours = settings.target_hours;
        newSettings.work_config = settings.work_config;
    }

    setSettings(newSettings);

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        display_name: newSettings.display_name,
        role: newSettings.role,
        target_hours: newSettings.target_hours,
        work_config: newSettings.work_config,
        preferences: newSettings.preferences,
        vacation_days_yearly: newSettings.vacation_days_yearly,
        employment_start_date: newSettings.employment_start_date,
        initial_overtime_balance: newSettings.initial_overtime_balance,
        updated_at: new Date().toISOString()
      });

    if (error) {
        console.error("Settings update failed:", error.message || JSON.stringify(error));
        return { error };
    }
    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  }

  return { settings, updateSettings, loading, logout };
};

export const useAbsences = (customUserId?: string) => {
    const [absences, setAbsences] = useState<UserAbsence[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAbsences = useCallback(async () => {
        setLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || (!user && !customUserId)) {
            setLoading(false);
            return;
        }

        let query = supabase.from('user_absences').select('*').order('start_date');
        
        if (customUserId) {
            query = query.eq('user_id', customUserId);
        } else if (user) {
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;
        if (error) console.error("Fetch Absences Error:", error.message || JSON.stringify(error));
        else setAbsences(data as UserAbsence[]);
        setLoading(false);
    }, [customUserId]);

    useEffect(() => { 
        fetchAbsences(); 
        const channel = supabase
          .channel('realtime_absences')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_absences' }, () => {
            fetchAbsences();
          })
          .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchAbsences]);

    const addAbsence = async (absence: Omit<UserAbsence, 'id' | 'user_id'> & { user_id?: string }) => {
        const { data: { user } } = await supabase.auth.getUser();
        const targetUserId = customUserId || user?.id || absence.user_id;

        if (!targetUserId) {
            console.error("No user ID for absence");
            return;
        }

        const { error } = await supabase.from('user_absences').insert([{
            ...absence,
            user_id: targetUserId
        }]);
        if (error) alert("Fehler beim Speichern der Abwesenheit: " + (error.message || JSON.stringify(error)));
    };

    const deleteAbsence = async (id: string) => {
        const { error } = await supabase.from('user_absences').delete().eq('id', id);
        if (error) alert("Fehler beim Löschen: " + (error.message || JSON.stringify(error)));
    };

    const deleteAbsenceDay = async (dateStr: string, type: string) => {
        const target = absences.find(a => 
            a.type === type && 
            a.start_date <= dateStr && 
            a.end_date >= dateStr
        );
        
        if (!target) return;

        const addDays = (d: string, days: number) => {
            const date = new Date(d);
            date.setDate(date.getDate() + days);
            return getLocalISOString(date);
        };

        try {
            if (target.start_date === target.end_date) {
                await deleteAbsence(target.id);
            } else if (target.start_date === dateStr) {
                const { error } = await supabase.from('user_absences').update({
                    start_date: addDays(dateStr, 1)
                }).eq('id', target.id);
                if (error) throw error;
                await fetchAbsences();
            } else if (target.end_date === dateStr) {
                const { error } = await supabase.from('user_absences').update({
                    end_date: addDays(dateStr, -1)
                }).eq('id', target.id);
                if (error) throw error;
                await fetchAbsences();
            } else {
                const originalEnd = target.end_date;
                const { error: updateError } = await supabase.from('user_absences').update({
                    end_date: addDays(dateStr, -1)
                }).eq('id', target.id);
                if (updateError) throw updateError;

                await addAbsence({
                    user_id: target.user_id,
                    type: target.type,
                    start_date: addDays(dateStr, 1),
                    end_date: originalEnd,
                    note: target.note
                });
            }
        } catch (err: any) {
            alert("Fehler beim Anpassen der Abwesenheit: " + (err.message || JSON.stringify(err)));
        }
    };

    return { absences, addAbsence, deleteAbsence, deleteAbsenceDay, loading, fetchAbsences };
};

export const useVacationRequests = (customUserId?: string) => {
    const [requests, setRequests] = useState<VacationRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || (!user && !customUserId)) {
            setLoading(false);
            return;
        }
        
        let query = supabase.from('vacation_requests').select('*').order('created_at', { ascending: false });
        
        if (customUserId) {
            query = query.eq('user_id', customUserId);
        } else if (user) {
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;
        if (error) {
             console.error("Fetch Requests Error:", error.message || JSON.stringify(error));
        } else {
             setRequests(data as VacationRequest[]);
        }
        setLoading(false);
    }, [customUserId]);

    useEffect(() => {
        fetchRequests();
        const channel = supabase
          .channel('realtime_requests')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'vacation_requests' }, () => {
            fetchRequests();
          })
          .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchRequests]);

    const createRequest = async (start: string, end: string, note?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;
        
        const { error } = await supabase.from('vacation_requests').insert({
            user_id: user.id,
            start_date: start,
            end_date: end,
            note,
            status: 'pending'
        });
        
        if(error) alert("Fehler beim Erstellen des Antrags: " + (error.message || JSON.stringify(error)));
    };

    const deleteRequest = async (id: string) => {
        const { error } = await supabase.from('vacation_requests').delete().eq('id', id);
        if(error) alert("Löschen fehlgeschlagen: " + (error.message || JSON.stringify(error)));
    }

    const approveRequest = async (request: VacationRequest) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: adminSettings } = await supabase
            .from('user_settings')
            .select('display_name')
            .eq('user_id', user.id)
            .single();

        const adminName = adminSettings?.display_name || 'Admin';

        const { error: updateError } = await supabase
            .from('vacation_requests')
            .update({ 
                status: 'approved',
                approved_by: user.id,
                approved_by_name: adminName
            })
            .eq('id', request.id);
        
        if (updateError) {
            alert("Genehmigung fehlgeschlagen: " + (updateError.message || JSON.stringify(updateError)));
            return;
        }

        const { error: insertError } = await supabase.from('user_absences').insert({
            user_id: request.user_id,
            start_date: request.start_date,
            end_date: request.end_date,
            type: 'vacation',
            note: request.note || 'Urlaubsantrag genehmigt'
        });

        if (insertError) {
            alert("Warnung: Status aktualisiert, aber Kalendereintrag fehlgeschlagen: " + (insertError.message || JSON.stringify(insertError)));
        }
    };

    const rejectRequest = async (id: string) => {
        const { error } = await supabase
            .from('vacation_requests')
            .update({ status: 'rejected' })
            .eq('id', id);
        if (error) alert("Ablehnung fehlgeschlagen: " + (error.message || JSON.stringify(error)));
    }

    return { requests, createRequest, deleteRequest, approveRequest, rejectRequest, loading };
};

export const useOfficeService = () => {
    const [users, setUsers] = useState<UserSettings[]>([]);
    
    const fetchAllUsers = useCallback(async () => {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .order('display_name');
        
        if (error) console.error("Fetch Users Error:", error.message || JSON.stringify(error));
        else setUsers(data as UserSettings[]);
    }, []);

    useEffect(() => {
        const channel = supabase
            .channel('realtime_office_users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, () => {
                fetchAllUsers();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchAllUsers]);

    const updateOfficeUserSettings = async (userId: string, updates: Partial<UserSettings>) => {
        await supabase.from('user_settings').update(updates).eq('user_id', userId);
    }

    return { users, fetchAllUsers, updateOfficeUserSettings };
};
