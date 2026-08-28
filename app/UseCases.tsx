const USE_CASES = [
  {
    title: "A password you'd rather not type into a chat box",
    description: "Wi-Fi codes, shared logins, a one-off staging password — handed over once, then gone.",
  },
  {
    title: "Something with a name and a number attached",
    description: "Bank details, ID numbers, anything you wouldn't want sitting in someone's inbox.",
  },
  {
    title: "A handoff between people who don't share a Slack",
    description: "SSH keys, API tokens, database access — passed to a contractor or client without a permanent trail.",
  },
  {
    title: "A message meant to be read exactly once",
    description: "Something personal, awkward, or just none of anyone else's business.",
  },
];

export default function UseCases() {
  return (
    <div className="usecase-grid">
      {USE_CASES.map((useCase) => (
        <div className="usecase-card" key={useCase.title}>
          <h3>{useCase.title}</h3>
          <p className="muted">{useCase.description}</p>
        </div>
      ))}
    </div>
  );
}
