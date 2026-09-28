package com.vitavet.backend;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vitavet.backend.repository.CitaRepository;
import com.vitavet.backend.repository.PagoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class BackendApplicationTests {

	@Autowired
	private CitaRepository citaRepository;

	@Autowired
	private PagoRepository pagoRepository;

	@Test
	void contextLoads() {
	}

	@Test
	void ownerQueriesRunWithoutChangingDatabaseData() {
		int nonexistentUserId = Integer.MIN_VALUE;
		assertTrue(citaRepository.findAllByUsuarioId(nonexistentUserId).isEmpty());
		assertTrue(citaRepository.findByIdCitaAndUsuarioId(nonexistentUserId, nonexistentUserId).isEmpty());
		assertTrue(pagoRepository.findAllByUsuarioId(nonexistentUserId).isEmpty());
		assertTrue(pagoRepository.findByIdPagoAndUsuarioId(nonexistentUserId, nonexistentUserId).isEmpty());
	}

}
