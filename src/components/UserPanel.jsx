import { useState, useEffect, useCallback } from 'react'
import Calendar from './Calendar'
import Modal from './Modal'
import { TIME_SLOTS, USERS } from '../lib/supabase'
import { 
  getReservations, 
  getReservationsByUser, 
  createReservation, 
  cancelReservation,
  subscribeToReservations 
} from '../lib/api'
import { 
  formatDate, 
  formatDatePL, 
  formatDateTime, 
  isSameDay, 
  getStartOfDay, 
  addDays,
  parseDate 
} from '../lib/utils'

export default function UserPanel({ user, showToast }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedHour, setSelectedHour] = useState(null)
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [reservations, setReservations] = useState([])
  const [myReservations, setMyReservations] = useState([])

  const today = getStartOfDay(new Date())
  const minDate = today
  const maxDate = addDays(today, 3) // Changed from 2 to 3 days

  // Get current hour to block past slots
  const currentHour = new Date().getHours()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [all, mine] = await Promise.all([
        getReservations(),
        getReservationsByUser(user)
      ])
      setReservations(all)
      
      // Filtruj przeszłe rezerwacje - pokazuj tylko dzisiejsze i przyszłe
      const todayStr = formatDate(new Date())
      const futureReservations = mine.filter(r => r.date >= todayStr)
      setMyReservations(futureReservations)
    } catch (err) {
      showToast('Błąd ładowania danych: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    loadData()
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToReservations(() => {
      loadData()
    })
    
    return () => unsubscribe()
  }, [loadData])

  // Check if user can make a reservation (1 per 2 calendar days)
  const canMakeReservation = useCallback(() => {
    if (!selectedDate || myReservations.length === 0) return true
    
    const lastReservation = myReservations[myReservations.length - 1]
    const lastDate = getStartOfDay(parseDate(lastReservation.date))
    const selectedDateStart = getStartOfDay(selectedDate)
    
    const minNextDate = addDays(lastDate, 2)
    return selectedDateStart >= minNextDate
  }, [selectedDate, myReservations])

  // Get earliest available date for user
  const getEarliestAvailableDate = useCallback(() => {
    if (myReservations.length === 0) return today
    
    const lastReservation = myReservations[myReservations.length - 1]
    const lastDate = getStartOfDay(parseDate(lastReservation.date))
    return addDays(lastDate, 2)
  }, [myReservations, today])

  // Check if a slot is occupied
  const isSlotOccupied = useCallback((date, hour) => {
    return reservations.some(r => 
      isSameDay(parseDate(r.date), date) && r.hour === hour
    )
  }, [reservations])

  // Can cancel reservation (60 min before)
  const canCancelReservation = (reservation) => {
    const now = new Date()
    const reservationTime = parseDate(reservation.date)
    reservationTime.setHours(reservation.hour, 0, 0, 0)
    const diffMinutes = (reservationTime - now) / (1000 * 60)
    return diffMinutes > 60
  }

  const handleReserve = () => {
    if (!selectedDate || selectedHour === null) {
      showToast('Wybierz datę i godzinę', 'error')
      return
    }

    if (!canMakeReservation()) {
      const earliestDate = getEarliestAvailableDate()
      showToast(`Możesz zarezerwować najwcześniej ${formatDatePL(earliestDate)}`, 'error')
      return
    }

    if (isSlotOccupied(selectedDate, selectedHour)) {
      showToast('Ten termin jest już zajęty', 'error')
      return
    }

    setModal({
      title: 'Potwierdzenie rezerwacji',
      message: `Czy na pewno chcesz zarezerwować termin ${formatDateTime(selectedDate, selectedHour)}? Wejście trwa 50 minut.`,
      onConfirm: async () => {
        try {
          setActionLoading(true)
          await createReservation(user, selectedDate, selectedHour)
          setSelectedHour(null)
          setModal(null)
          showToast('Rezerwacja została dodana!', 'success')
          await loadData()
        } catch (err) {
          showToast('Błąd: ' + err.message, 'error')
        } finally {
          setActionLoading(false)
        }
      },
      onCancel: () => setModal(null)
    })
  }

  const handleCancel = (reservation) => {
    if (!canCancelReservation(reservation)) {
      showToast('Nie można odwołać rezerwacji na mniej niż 60 minut przed terminem', 'error')
      return
    }

    setModal({
      title: 'Odwołanie rezerwacji',
      message: `Czy na pewno chcesz odwołać rezerwację na ${formatDateTime(reservation.date, reservation.hour)}?`,
      onConfirm: async () => {
        try {
          setActionLoading(true)
          await cancelReservation(reservation.id, user)
          setModal(null)
          showToast('Rezerwacja została odwołana', 'success')
          await loadData()
        } catch (err) {
          showToast('Błąd: ' + err.message, 'error')
        } finally {
          setActionLoading(false)
        }
      },
      onCancel: () => setModal(null)
    })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="loader"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
      {/* Calendar Section */}
      <div className="bg-white rounded-3xl p-8 shadow-xl mb-8 border-2 border-green-200">
        <h2 className="font-display text-2xl text-green-800 mb-6 flex items-center gap-3">
          📅 Wybierz termin
        </h2>
        
        {/* Info Box */}
        <div className="bg-green-100 border-2 border-green-400 rounded-2xl p-5 mb-6">
          <p className="text-green-800 leading-relaxed">
            <strong>Zasady rezerwacji:</strong> Możesz zarezerwować 1 wejście na 2 dni. 
            Wejście trwa 50 minut. Odwołanie możliwe 60 minut przed rezerwacją.
          </p>
          {myReservations.length > 0 && (
            <p className="mt-3 text-green-700">
              <strong>Najwcześniejsza możliwa rezerwacja:</strong> {formatDatePL(getEarliestAvailableDate())}
            </p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
          <Calendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            minDate={minDate}
            maxDate={maxDate}
          />

          {selectedDate && (
            <div className="flex-1 min-w-[300px]">
              <h3 className="font-display text-xl text-green-800 mb-4">
                🕐 Godziny - {formatDatePL(selectedDate)}
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {TIME_SLOTS.map(slot => {
                  const occupied = isSlotOccupied(selectedDate, slot.hour)
                  const isToday = isSameDay(selectedDate, today)
                  const isPastHour = isToday && slot.hour <= currentHour
                  
                  if (!slot.bookable) {
                    return (
                      <div 
                        key={slot.hour} 
                        className="p-4 rounded-2xl text-center bg-green-100 border-2 border-green-400"
                      >
                        <div className="text-xl font-bold text-green-800">{slot.hour}:00</div>
                        <div className="text-xs uppercase tracking-wide text-green-600 mt-1">
                          {slot.info}
                        </div>
                      </div>
                    )
                  }

                  const isUnavailable = occupied || isPastHour

                  return (
                    <div
                      key={slot.hour}
                      className={`
                        p-4 rounded-2xl text-center border-2 transition-all
                        ${isUnavailable 
                          ? 'bg-red-50 border-red-200 cursor-not-allowed' 
                          : selectedHour === slot.hour
                            ? 'bg-gradient-to-br from-green-400 to-green-700 text-white border-green-700'
                            : 'bg-white border-green-200 cursor-pointer hover:border-green-400 hover:-translate-y-1 hover:shadow-lg'
                        }
                      `}
                      onClick={() => !isUnavailable && setSelectedHour(slot.hour)}
                    >
                      <div className="text-xl font-bold">{slot.hour}:00</div>
                      <div className={`text-xs uppercase tracking-wide mt-1 ${
                        isUnavailable ? 'text-red-600' : selectedHour === slot.hour ? 'text-green-100' : 'text-green-600'
                      }`}>
                        {isPastHour ? 'MINĘŁO' : occupied ? 'ZAJĘTE' : 'Dostępne'}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                className="w-full mt-8 py-5 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-2xl text-xl font-bold uppercase tracking-widest hover:-translate-y-1 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                onClick={handleReserve}
                disabled={selectedHour === null}
              >
                REZERWUJ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* My Reservations */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
        <h2 className="font-display text-2xl text-green-800 mb-6 flex items-center gap-3">
          📋 Moje rezerwacje
        </h2>
        
        {myReservations.length === 0 ? (
          <div className="text-center text-green-600 py-10 italic">
            Brak aktywnych rezerwacji
          </div>
        ) : (
          myReservations.map(reservation => (
            <div 
              key={reservation.id} 
              className="bg-green-100 rounded-2xl p-5 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-2 border-green-200"
            >
              <div>
                <h4 className="font-display text-lg text-green-800">
                  {formatDateTime(reservation.date, reservation.hour)}
                </h4>
                <p className="text-green-600 text-sm">Rezerwacja trwa 50 minut</p>
              </div>
              <button
                className={`px-5 py-2 rounded-xl font-semibold transition-all ${
                  canCancelReservation(reservation)
                    ? 'bg-red-50 text-red-700 border-2 border-red-200 hover:bg-red-600 hover:text-white'
                    : 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                }`}
                onClick={() => handleCancel(reservation)}
                disabled={!canCancelReservation(reservation)}
              >
                {canCancelReservation(reservation) ? 'Odwołaj' : 'Nie można odwołać'}
              </button>
            </div>
          ))
        )}
      </div>

      {modal && <Modal {...modal} loading={actionLoading} />}
    </div>
  )
}
