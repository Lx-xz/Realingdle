"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import Loading from "@/components/Loading"
import "./page.sass"

interface RankProfile {
	id: string
	display_name: string | null
	wins: number | null
	games_played: number | null
}

const sortRankProfiles = (profiles: RankProfile[]) =>
	[...profiles].sort((left, right) => {
		const leftWins = left.wins ?? 0
		const rightWins = right.wins ?? 0
		if (leftWins !== rightWins) {
			return rightWins - leftWins
		}

		const leftGames = left.games_played ?? 0
		const rightGames = right.games_played ?? 0
		if (leftGames !== rightGames) {
			return leftGames - rightGames
		}

		const leftName = left.display_name?.trim() || ""
		const rightName = right.display_name?.trim() || ""
		return leftName.localeCompare(rightName, "pt-BR", {
			sensitivity: "base",
		})
	})

export default function RankPage() {
	const [profiles, setProfiles] = useState<RankProfile[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState("")

	useEffect(() => {
		const loadProfiles = async () => {
			setError("")
			const { data, error: rpcError } = await supabase.rpc("get_rank_profiles")

			let rows: RankProfile[] | null = null
			let profilesError = rpcError

			if (!rpcError && data) {
				rows = data as RankProfile[]
			} else {
				const { data: fallbackData, error: fallbackError } = await supabase
					.from("profiles")
					.select("id, display_name, wins, games_played")

				rows = (fallbackData as RankProfile[]) ?? []
				profilesError = fallbackError
			}

			if (profilesError) {
				setError("Não foi possível carregar o ranking.")
				setLoading(false)
				return
			}

			setProfiles(sortRankProfiles(rows ?? []))
			setLoading(false)
		}

		loadProfiles()

		const channel = supabase
			.channel("rank-page-profiles")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "profiles" },
				() => {
					loadProfiles()
				},
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [])

	const hasProfiles = useMemo(() => profiles.length > 0, [profiles])

	return (
		<div className="rank-page">
			<div className="rank-page__card">
				<h1 className="rank-page__title">Ranking</h1>

				{loading && (
					<div className="rank-page__status">
						<Loading label="Carregando ranking..." />
					</div>
				)}
				{!loading && error && <p className="rank-page__error">{error}</p>}
				{!loading && !error && !hasProfiles && (
					<p className="rank-page__status">Nenhum perfil encontrado.</p>
				)}

				{!loading && !error && hasProfiles && (
					<div className="rank-page__table-wrapper">
						<table className="rank-page__table">
							<thead>
								<tr>
									<th>#</th>
									<th>Nome</th>
									<th>Vitórias</th>
									<th>Jogos</th>
								</tr>
							</thead>
							<tbody>
								{profiles.map((profile, index) => (
									<tr key={profile.id}>
										<td>{index + 1}</td>
										<td>{profile.display_name?.trim() || "Sem nome"}</td>
										<td>{profile.wins ?? 0}</td>
										<td>{profile.games_played ?? 0}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	)
}
