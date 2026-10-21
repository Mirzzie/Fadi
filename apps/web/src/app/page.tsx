import { ArrowDown, ArrowRight, Check, Plus } from "lucide-react";
import Link from "next/link";

import { FadiLogo } from "@/components/brand/fadi-logo";
import styles from "./home.module.css";

const steps = [
  {
    number: "01",
    title: "Start with your experience.",
    body: "Bring your CV, projects and goals together. Review the record before using it in an application.",
    label: "Your starting point",
  },
  {
    number: "02",
    title: "Choose a useful next move.",
    body: "Explore roles, prepare an application or practise a task. Keep the work connected to the direction you choose.",
    label: "Your next step",
  },
  {
    number: "03",
    title: "Keep what you learn.",
    body: "Save completed work and outcomes. Use that record when you update your CV, portfolio or interview preparation.",
    label: "Your working record",
  },
];

const questions = [
  {
    question: "Where should I start?",
    answer:
      "Create an account and add your existing experience during setup. You can use the form rather than a conversation. Start with what you have; you do not need a finished portfolio.",
  },
  {
    question: "Is Practice only for technical careers?",
    answer:
      "No. Practice includes written work simulations as well as technical projects and interview preparation. Available activities vary, and experimental activities are labelled.",
  },
  {
    question: "Will Fadi apply or publish on my behalf?",
    answer:
      "Preparing a draft is not permission to send it. Review the application, message or publishing action before approving any supported external action. You can also copy or download your work.",
  },
  {
    question: "How do I connect an AI provider?",
    answer:
      "Choose an available provider in Settings. Depending on your installation, this can use an API key, a local model or a supported installed CLI login. Provider availability and usage limits still apply.",
  },
  {
    question: "Can I change direction later?",
    answer:
      "Yes. Your career record and your chosen direction are separate. Change the direction you are working toward without needing to invent a different history.",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/" className={styles.brand} aria-label="Fadi home">
            <span aria-hidden="true">
              <FadiLogo />
            </span>
            <span>Fadi</span>
          </Link>
          <div className={styles.navLinks}>
            <a href="#how">How it works</a>
            <a href="#faq">Questions</a>
          </div>
          <a className={styles.signIn} href="/auth/sign-in">
            Sign in
          </a>
        </nav>
      </header>
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <p className={styles.eyebrow}>
            <span aria-hidden="true" /> Your career work, connected
          </p>
          <h1 id="hero-title">
            Turn your next
            <br />
            career move into a <em>plan.</em>
          </h1>
          <p className={styles.intro}>
            Find a direction. Practise the work. Prepare your next application.
            <br className={styles.desktopBreak} /> One workspace for the steps in between.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="/auth/sign-up">
              Create your account <ArrowRight aria-hidden="true" />
            </a>
            <a className={styles.secondary} href="#how">
              See how it works <ArrowDown aria-hidden="true" />
            </a>
          </div>
          <div className={styles.horizon} aria-hidden="true" />
          <figure className={styles.preview}>
            <figcaption>
              One connected workflow <span>Illustrative example · not account data</span>
            </figcaption>
            <div className={styles.example}>
              <div className={styles.exampleContext}>
                <span>YOUR DIRECTION</span>
                <p>Work worth moving toward.</p>
                <small>Opportunities → Practice → Your record</small>
              </div>
              <div className={styles.exampleSteps}>
                <div>
                  <span className={styles.stepMarker}>01</span>
                  <p>
                    Choose a role<small>Compare requirements with your experience.</small>
                  </p>
                </div>
                <div>
                  <span className={styles.stepMarker}>02</span>
                  <p>
                    Prepare the work<small>Draft, practise and review what needs attention.</small>
                  </p>
                </div>
                <div>
                  <span className={styles.stepMarker}>
                    <Check aria-hidden="true" />
                  </span>
                  <p>
                    Keep the outcome<small>Record what happened before taking the next step.</small>
                  </p>
                </div>
              </div>
            </div>
          </figure>
        </section>
        <section id="how" className={styles.section} aria-labelledby="how-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>LESS SCATTERED. MORE CONNECTED.</p>
            <h2 id="how-title">
              A place for your
              <br />
              <em>next chapter.</em>
            </h2>
            <p>The plan matters. So does having room to do the work.</p>
          </div>
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step.number}>
                <span className={styles.number}>{step.number}</span>
                <div>
                  <p className={styles.kicker}>{step.label}</p>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
                <ArrowRight className={styles.stepArrow} aria-hidden="true" />
              </li>
            ))}
          </ol>
        </section>
        <section id="faq" className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>A FEW PRACTICAL DETAILS</p>
            <h2 id="faq-title">
              Before you <em>begin.</em>
            </h2>
          </div>
          <div className={styles.questions}>
            {questions.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <Plus aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={styles.closing} aria-labelledby="closing-title">
          <p className={styles.kicker}>START WITH WHAT YOU HAVE</p>
          <h2 id="closing-title">
            Make space for
            <br />
            your <em>next move.</em>
          </h2>
          <p>Your experience, your direction, one useful step.</p>
          <a className={styles.primary} href="/auth/sign-up">
            Create your account <ArrowRight aria-hidden="true" />
          </a>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>Fadi</span>
        <p>AI assistance for career work. Review recommendations before acting.</p>
        <a href="/auth/sign-in">
          Sign in <ArrowRight aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
