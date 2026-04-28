import Image from 'next/image'

interface LogoProps {
  size?: number
  className?: string
  animated?: boolean
}

export default function Logo({ size = 48, className = '', animated = false }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="GroupTab"
      width={size}
      height={size}
      className={`${animated ? 'anim-logo' : ''} ${className}`}
      priority
    />
  )
}
