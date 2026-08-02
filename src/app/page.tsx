import LoginPage from './login/page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TestAS Mock Test & Exam Preparation | KNI Education',
  description: 'Prepare for the TestAS exam with our high-fidelity digital mock tests. Practice under real timed conditions and track your progress with KNI Education.',
  alternates: {
    canonical: 'https://www.kni.vn/',
  },
  openGraph: {
    title: 'TestAS Mock Test & Exam Preparation | KNI Education',
    description: 'Prepare for the TestAS exam with our high-fidelity digital mock tests. Practice under real timed conditions and track your progress with KNI Education.',
    url: 'https://www.kni.vn/',
    type: 'website',
  },
};

export default function HomePage() {
  return <LoginPage />;
}
