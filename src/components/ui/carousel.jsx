'use client';

import { useEffect, useState } from "react";
import Image from 'next/image';
import Link from 'next/link';

const Carousel = ({ teammates }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % teammates.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [teammates.length]);

  const getTransformStyle = (index) => {
    const offset = index - currentIndex;
    return `translateX(${offset * 100}%)`;
  };

  return (
    teammates.map((teammate, index) => (
      <div key={index} className="bg-card rounded-lg overflow-hidden">
        <Image
          src={teammate.image}
          width={400}
          height={400}
          alt="Team Member"
          className="w-full h-48 object-cover"
          style={{ aspectRatio: '400/400', objectFit: 'cover' }}
        />
        <div className="p-4">
          <h3 className="text-lg font-semibold">{teammate.full_name}</h3>
          <p className="text-muted-foreground">{teammate.rol}</p>
          <div className="flex items-center justify-left gap-3 mt-2">
            {teammate.linkedin && (
              <Link
                href={teammate.linkedin}
                target="_blank"
                className="text-muted-foreground hover:underline"
                prefetch={false}
              >
                <LinkedinIcon className="h-5 w-5" />
              </Link>
            )}
            {teammate.instagram && (
              <Link
                href={teammate.instagram}
                target="_blank"
                className="text-muted-foreground hover:underline"
                prefetch={false}
              >
                <InstagramIcon className="h-5 w-5" />
              </Link>
            )}
            {teammate.github && (
              <Link
                href={teammate.github}
                target="_blank"
                className="text-muted-foreground hover:underline"
                prefetch={false}
              >
                <GithubIcon className="h-5 w-5" />
              </Link>
            )}
            {teammate.twitter && (
              <Link
                href={teammate.twitter}
                target="_blank"
                className="text-muted-foreground hover:underline"
                prefetch={false}
              >
                <TwitterIcon className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    ))
  );
};

export default Carousel;


export function GithubIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function InstagramIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function LinkedinIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export function TwitterIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}
