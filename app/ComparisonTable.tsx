type Cell = "yes" | "no" | "partial";

const SYMBOL: Record<Cell, string> = { yes: "✓", no: "✗", partial: "–" };
const LABEL: Record<Cell, string> = { yes: "Yes", no: "No", partial: "Partial" };

const ROWS: { feature: string; selfdestruct: Cell; email: Cell; chat: Cell }[] = [
  { feature: "End-to-end encrypted", selfdestruct: "yes", email: "no", chat: "partial" },
  { feature: "Deleted after reading", selfdestruct: "yes", email: "no", chat: "no" },
  { feature: "Server never sees plaintext", selfdestruct: "yes", email: "no", chat: "partial" },
  { feature: "No account required to send", selfdestruct: "yes", email: "no", chat: "no" },
  { feature: "Leaves no message history", selfdestruct: "yes", email: "no", chat: "no" },
  { feature: "Built-in expiration timer", selfdestruct: "yes", email: "no", chat: "no" },
  { feature: "Duress passphrase", selfdestruct: "yes", email: "no", chat: "no" },
];

function Mark({ value }: { value: Cell }) {
  return (
    <span
      className={`compare-mark compare-mark-${value}`}
      role="img"
      aria-label={LABEL[value]}
      title={LABEL[value]}
    >
      {SYMBOL[value]}
    </span>
  );
}

export default function ComparisonTable() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="compare-table compare-table-marks">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col" className="compare-table-highlight">Selfdestruct</th>
            <th scope="col">Email</th>
            <th scope="col">Chat &amp; video apps</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.feature}>
              <th scope="row">{row.feature}</th>
              <td className="compare-table-highlight">
                <Mark value={row.selfdestruct} />
              </td>
              <td>
                <Mark value={row.email} />
              </td>
              <td>
                <Mark value={row.chat} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
