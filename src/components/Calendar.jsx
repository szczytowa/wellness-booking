import { useState } from 'react'
import { MONTHS_PL } from '../lib/supabase'
import { getStartOfDay, isSameDay } from '../lib/utils'

export default function Calendar({ selectedDate, onSelectDate, minDate, maxDate }) {
  const [viewDate, setViewDate] = useState(new Date())
  const today = getStartOfDay(new Date())

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay()
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  
  // Adjust for Monday start
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1

  const days = []
  for (let i = 0; i < adjustedFirstDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const isDateSelectable = (day) => {
    if (!day) return false
    const date = new Date(year, month, day)
    const dateStart = getStartOfDay(date)
    const minDateStart = getStartOfDay(minDate)
    const maxDateStart = getStartOfDay(maxDate)
    return dateStart >= minDateStart && dateStart <= maxDateStart
  }

  return (
    <div className="min-w-[320px]">
      <div className="flex justify-between items-center mb-5">
        <button 
          className="w-10 h-10 rounded-full bg-green-100 border-2 border-green-400 text-green-800 flex items-center justify-center hover:bg-green-400 hover:text-white transition-all"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
        >
          ←
        </button>
        <span className="font-display text-xl text-green-800">
          {MONTHS_PL[month]} {year}
        </span>
        <button 
          className="w-10 h-10 rounded-full bg-green-100 border-2 border-green-400 text-green-800 flex items-center justify-center hover:bg-green-400 hover:text-white transition-all"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
        >
          →
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(day => (
          <div key={day} className="text-center font-bold text-green-800 py-2 text-sm uppercase">
            {day}
          </div>
        ))}
        
        {days.map((day, idx) => {
          const date = day ? new Date(year, month, day) : null
          const selectable = isDateSelectable(day)
          const isSelected = date && selectedDate && isSameDay(date, selectedDate)
          const isToday = date && isSameDay(date, today)

          return (
            <div
              key={idx}
              className={`
                aspect-square flex items-center justify-center rounded-xl font-semibold transition-all min-w-[45px]
                ${!day ? 'bg-transparent cursor-default' : 'bg-green-50 border-2 border-transparent'}
                ${!selectable && day ? 'opacity-30 cursor-not-allowed' : ''}
                ${selectable ? 'cursor-pointer hover:border-green-400 hover:scale-105' : ''}
                ${isSelected ? 'bg-gradient-to-br from-green-400 to-green-700 text-white border-green-700' : ''}
                ${isToday && !isSelected ? 'border-green-400 bg-green-100' : ''}
              `}
              onClick={() => selectable && onSelectDate(date)}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
