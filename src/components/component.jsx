/** Add fonts into your Next.js project:
import { Archivo } from 'next/font/google'
import { Libre_Franklin } from 'next/font/google'

archivo({
  subsets: ['latin'],
  display: 'swap',
})

libre_franklin({
  subsets: ['latin'],
  display: 'swap',
})

To read more about using these font, please visit the Next.js documentation:
- App Directory: https://nextjs.org/docs/app/building-your-application/optimizing/fonts
- Pages Directory: https://nextjs.org/docs/pages/building-your-application/optimizing/fonts
**/
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

export function Component() {
  return (
    (<div className="flex flex-col min-h-[100dvh]">
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-primary">
        <div className="container px-4 md:px-6">
          <div
            className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1
                  className="text-3xl font-bold tracking-tighter text-primary-foreground sm:text-5xl xl:text-6xl/none">
                  The Last Hope Development
                </h1>
                <p className="max-w-[550px] text-primary-foreground md:text-xl">
                  Nuestro talentoso equipo de expertos freelance se especializa en crear soluciones digitales excepcionales, personalizadas para satisfacer tus necesidades únicas. Permítenos ayudarte a alcanzar tus objetivos.
                </p>
              </div>
            </div>
            <Image
              src="/home.png"
              width={400}
              height={400}
              alt="Hero"
              className="sm:w-full lg:order-last" />
          </div>
        </div>
      </section>
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Conoce a nuestro equipo</h2>
            <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              Nuestro talentoso equipo de diseñadores y desarrolladores está dedicado a ofrecer resultados excepcionales para nuestros clientes.
            </p>
          </div>
          <div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-8">
            <div className="bg-card rounded-lg overflow-hidden">
              <Image
                src="/maicol.png"
                width={400}
                height={400}
                alt="Team Member"
                className="w-full h-48 object-cover"
                style={{ aspectRatio: "400/400", objectFit: "cover" }} />
              <div className="p-4">
                <h3 className="text-lg font-semibold">Maicol Arroyave Alvarez</h3>
                <p className="text-muted-foreground">Desarrollador Frontend</p>
                <div className="flex items-center justify-left gap-2 mt-2">
                  <Link
                      href="https://www.linkedin.com/in/maicolaa/"
                      target="_blank"
                      className="text-muted-foreground hover:underline"
                      prefetch={false}>
                      <LinkedinIcon className="h-5 w-5" />
                    </Link>
                    <Link
                      href="https://www.instagram.com/maicol.arroyave.9/"
                      target="_blank"
                      className="text-muted-foreground hover:underline"
                      prefetch={false}>
                      <InstagramIcon className="h-5 w-5" />
                    </Link>
                    <Link
                      href="https://github.com/MaicolAA"
                      target="_blank"
                      className="text-muted-foreground hover:underline"
                      prefetch={false}>
                      <GithubIcon className="h-5 w-5" />
                    </Link>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg overflow-hidden">
              <Image
                src="/emmanuel.png"
                width={400}
                height={400}
                alt="Team Member"
                className="w-full h-48 object-cover"
                style={{ aspectRatio: "400/400", objectFit: "cover" }} />
              <div className="p-4">
                <h3 className="text-lg font-semibold">Emmanuel Monsalve Parra</h3>
                <p className="text-muted-foreground">Desarrollador Full Stack</p>
                <div className="flex items-center justify-left gap-3 mt-2">
                  <Link
                    href="https://www.linkedin.com/in/emmanuelmonsalve/"
                    target="_blank"
                    className="text-muted-foreground hover:underline"
                    prefetch={false}>
                    <LinkedinIcon className="h-5 w-5" />
                  </Link>
                  <Link
                    href="https://www.instagram.com/emmusmp/"
                    target="_blank"
                    className="text-muted-foreground hover:underline"
                    prefetch={false}>
                    <InstagramIcon className="h-5 w-5" />
                  </Link>
                  <Link
                    href="https://github.com/MachinEmmus"
                    target="_blank"
                    className="text-muted-foreground hover:underline"
                    prefetch={false}>
                    <GithubIcon className="h-5 w-5" />
                  </Link>
                  <Link
                    href="https://x.com/emmusmp"
                    target="_blank"
                    className="text-muted-foreground hover:underline"
                    prefetch={false}>
                    <TwitterIcon className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg overflow-hidden">
              <Image
                src="/camilo.png"
                width={400}
                height={400}
                alt="Team Member"
                className="w-full h-48 object-cover"
                style={{ aspectRatio: "400/400", objectFit: "cover" }} />
              <div className="p-4">
                <h3 className="text-lg font-semibold">Juan Camilo Gonzalez Hoyos</h3>
                <p className="text-muted-foreground">Desarrolador Backend</p>
                <div className="flex items-center justify-left gap-3 mt-2">
                  <Link
                    href="https://www.linkedin.com/in/juan-camilo-gonzalez-hoyos/"
                    target="_blank"
                    className="text-muted-foreground hover:underline"
                    prefetch={false}>
                    <LinkedinIcon className="h-5 w-5" />
                  </Link>
                  <Link
                    href="https://www.linkedin.com/in/juan-camilo-gonzalez-hoyos/"
                    target="_blank"
                    className="text-muted-foreground hover:underline"
                    prefetch={false}>
                    <GithubIcon className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg overflow-hidden">
              <Image
                src="/santiago.png"
                width={400}
                height={400}
                alt="Team Member"
                className="w-full h-48 object-cover"
                style={{ aspectRatio: "400/400", objectFit: "cover" }} />
              <div className="p-4">
                <h3 className="text-lg font-semibold">Santiago Lopez Vallejo</h3>
                <p className="text-muted-foreground">Desarrollador Full Stack</p>
                <div className="flex items-center justify-left gap-3 mt-2">
                  <Link
                    href="https://www.linkedin.com/in/santyago43/"
                    target="_blank"
                    className="text-muted-foreground hover:underline"
                    prefetch={false}>
                    <LinkedinIcon className="h-5 w-5" />
                  </Link>
                  <Link
                    href="https://github.com/santyago43"
                    target="_blank"
                    className="text-muted-foreground hover:underline"
                    prefetch={false}>
                    <GithubIcon className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted">
        <div className="container px-4 md:px-6">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Proyectos realizados</h2>
            <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              Descubre algunos de los increíbles proyectos en los que hemos trabajado para nuestros clientes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
            <div className="bg-card rounded-lg overflow-hidden">
              <Link
                target="_blank"
                href="https://premium-academy-ashy.vercel.app/">
                <Image
                  src="/pa.png"
                  width={400}
                  height={300}
                  alt="Premium Academy"
                  className="w-full h-48 object-cover"
                  style={{ aspectRatio: "400/300", objectFit: "cover" }} />
              </Link>
              <div className="p-4">
                <h3 className="text-lg font-semibold">Premium Academy</h3>
                <p className="text-muted-foreground">Plataforma de aprendizaje y crecimiento personal</p>
              </div>
            </div>
            <div className="bg-card rounded-lg overflow-hidden">
              <Link
                target="_blank"
                href="https://arcopedicousa.com">
                <Image
                  src="/arcopedicousa.png"
                  width={400}
                  height={300}
                  alt="Arcopedicousa"
                  className="w-full h-48 object-cover"
                  style={{ aspectRatio: "400/300", objectFit: "cover" }} />
              </Link>
              <div className="p-4">
                <h3 className="text-lg font-semibold">Arcopedicousa</h3>
                <p className="text-muted-foreground">Plataforma AWS E-commerce de venta de zapatos</p>
              </div>
            </div>
            <div className="bg-card rounded-lg overflow-hidden">
              <Image
                src="/coding.png"
                width="400"
                height="300"
                alt="Project 3"
                className="w-full h-48 object-cover"
                style={{ aspectRatio: "400/300", objectFit: "cover" }} />
              <div className="p-4">
                <h3 className="text-lg font-semibold">Proximamente...</h3>
                <p className="text-muted-foreground">
                  El sitio de tus sueños
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Contáctanos</h2>
            <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
              ¿Tienes un proyecto en mente? Completa el formulario a continuación y nos pondremos en contacto contigo lo antes posible.
            </p>
          </div>
          <form className="max-w-md mx-auto mt-8 space-y-4">
            <Input type="text" placeholder="Nombre" className="w-full" />
            <Input type="email" placeholder="Email" className="w-full" />
            <Textarea placeholder="Mensaje" className="w-full" />
            <Button type="submit" className="w-full">
              Enviar
            </Button>
          </form>
        </div>
      </section>
      <footer
        className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; 2024 TLH Development. Todos los derechos reservados.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link
            href="#"
            className="text-xs hover:underline underline-offset-4"
            prefetch={false}>
            Terminos del servicio
          </Link>
          <Link
            href="#"
            className="text-xs hover:underline underline-offset-4"
            prefetch={false}>
            Privacidad
          </Link>
        </nav>
      </footer>
    </div>)
  );
}

function GithubIcon(props) {
  return (
    (<svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path
        d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>)
  );
}

function InstagramIcon(props) {
  return (
    (<svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>)
  );
}

function LinkedinIcon(props) {
  return (
    (<svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path
        d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>)
  );
}

function TwitterIcon(props) {
  return (
    (<svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path
        d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>)
  );
}
