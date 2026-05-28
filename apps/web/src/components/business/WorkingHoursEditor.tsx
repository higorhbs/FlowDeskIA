"use client";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_PT: Record<string, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

export type WorkingHoursValue = Record<string, [string, string] | null>;

type Props = {
  value: WorkingHoursValue;
  onChange: (value: WorkingHoursValue) => void;
};

export function defaultWorkingHours(): WorkingHoursValue {
  const h: WorkingHoursValue = {};
  DAY_KEYS.forEach((d) => {
    h[d] = d === "sun" ? null : ["09:00", "18:00"];
  });
  return h;
}

export function WorkingHoursEditor({ value, onChange }: Props) {
  function setDay(day: string, slot: [string, string] | null) {
    onChange({ ...value, [day]: slot });
  }

  return (
    <div className="space-y-3">
      {DAY_KEYS.map((day) => {
        const closed = value[day] === null || value[day] === undefined;
        const slot = value[day] ?? ["09:00", "18:00"];

        return (
          <div key={day} className="flex flex-wrap items-center gap-3 py-2 border-b border-gray-100 last:border-0">
            <span className="w-24 text-sm font-medium text-gray-700">{DAY_PT[day]}</span>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={closed}
                onChange={(e) => setDay(day, e.target.checked ? null : ["09:00", "18:00"])}
                className="rounded"
              />
              Fechado
            </label>
            {!closed && (
              <>
                <input
                  type="time"
                  className="input w-28 py-1.5 text-sm"
                  value={slot[0]}
                  onChange={(e) => setDay(day, [e.target.value, slot[1]])}
                />
                <span className="text-gray-400 text-sm">até</span>
                <input
                  type="time"
                  className="input w-28 py-1.5 text-sm"
                  value={slot[1]}
                  onChange={(e) => setDay(day, [slot[0], e.target.value])}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
